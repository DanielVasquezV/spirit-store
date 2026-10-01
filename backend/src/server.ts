import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { startAuctionLifecycleScheduler } from './modules/auction/auction.state.js';
import { startOrderExpiryScheduler } from './modules/order/order.expiry.js';
import { initSocketServer } from './socket/index.js';
import type { SocketServer } from './socket/index.js';

// El acople va por createServer(app) y no con un app.listen() propio: Socket.io
// necesita el upgrade de HTTP a WebSocket, y si Express se apropiara de esas
// conexiones los handshakes nunca llegarían.
export interface RunningServer {
  httpServer: HttpServer;
  sockets: SocketServer;
  port: number;
  stop: () => Promise<void>;
}

function listen(httpServer: HttpServer, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    // EADDRINUSE y EACCES llegan antes que 'listening' y deben tumbar el arranque.
    const onError = (err: Error): void => {
      httpServer.off('listening', onListening);
      reject(err);
    };
    const onListening = (): void => {
      httpServer.off('error', onError);
      const { port: boundPort } = httpServer.address() as AddressInfo;
      resolve(boundPort);
    };

    httpServer.once('error', onError);
    httpServer.once('listening', onListening);
    httpServer.listen(port);
  });
}

export async function startServer(): Promise<RunningServer> {
  // Conectar antes de aceptar tráfico: si la base no responde preferimos fallar
  // en el arranque que servir 500s en cada request.
  await prisma.$connect();

  const app = createApp();
  const httpServer = createServer(app);

  // Un solo servidor HTTP para REST y WebSockets.
  const sockets = initSocketServer(httpServer);

  // Sin esto el estado de una subasta solo avanzaria cuando alguien la mirara, y
  // como nadie mira una subasta que ya vencio, quedaria ACTIVE para siempre sin
  // ganador. Corre un tick apenas arranca para recuperar lo que se perdio con el
  // servidor caido.
  const lifecycle = startAuctionLifecycleScheduler();

  // Sin esto una orden abandonada a mitad del checkout deja el vehiculo
  // RESERVED para siempre, porque nadie mas va a cancelar esa orden.
  const orderExpiry = startOrderExpiryScheduler();

  const port = await listen(httpServer, env.port);

  // Tope por IP: frena la puja automatizada desde muchas cuentas sobre la misma
  // subasta.
  httpServer.maxConnections = 200;

  httpServer.headersTimeout = 65_000;
  httpServer.requestTimeout = 30_000;
  // Menor que headersTimeout: si no, Node corta antes de que termine de
  // negociar el upgrade de un WebSocket.
  httpServer.keepAliveTimeout = 61_000;

  let stopping: Promise<void> | null = null;

  const stop = async (): Promise<void> => {
    // Un segundo SIGTERM no debe duplicar el cierre.
    stopping ??= (async () => {
      // Primero los sockets: con un cliente conectado, close() del servidor HTTP
      // esperaría indefinidamente.
      await sockets.close();
      lifecycle.stop();
      orderExpiry.stop();
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
      await prisma.$disconnect();
    })();
    return stopping;
  };

  // El margen de 10s le da a Kubernetes o Docker tiempo a cortar el tráfico
  // antes de que el proceso muera.
  const registerShutdown = (signal: NodeJS.Signals): void => {
    process.once(signal, () => {
      console.log(`[server] ${signal} recibido, cerrando...`);
      const forceExit = setTimeout(() => {
        console.error('[server] cierre forzado tras 10s');
        process.exit(1);
      }, 10_000);
      forceExit.unref();

      void stop()
        .then(() => {
          console.log('[server] cerrado limpiamente');
          process.exit(0);
        })
        .catch((err: unknown) => {
          console.error('[server] error durante el cierre:', err);
          process.exit(1);
        });
    });
  };

  registerShutdown('SIGINT');
  registerShutdown('SIGTERM');

  return { httpServer, sockets, port, stop };
}

// Cualquier fallo acá sale con código 1 para que el orquestador reinicie.
export async function bootstrap(): Promise<RunningServer> {
  const running = await startServer();

  console.log(`[server] SpiritApex API escuchando en http://localhost:${running.port}`);
  console.log(`[server] WebSockets en ws://localhost:${running.port}/socket.io`);
  console.log(`[server] Entorno: ${env.nodeEnv} | CORS: ${JSON.stringify(env.clientUrl)}`);

  return running;
}
