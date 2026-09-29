import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { docsRouter } from './docs/docs.router.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

// Monta la app sin escuchar en ningún puerto: el servidor HTTP y el socket los
// crea server.ts, así se puede testear sin abrir sockets.
//
// El orden importa: helmet antes de que nada escriba, cors antes del 404 (si no
// un origen rechazado recibe un 404 mudo en vez del motivo), parsers con tope
// para no deserializar cuerpos enormes, y el par notFound + errorHandler
// siempre al final.
export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  // Detrás de un balanceador: hace que req.ip sea la IP real, que es lo que
  // necesita el rate limiting por IP.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // API sin HTML: una CSP restrictiva no aporta y complica el dev server
      // de Expo.
      contentSecurityPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: env.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  app.use(
    cors({
      // Viene resuelto a true (desarrollo) o a la lista de orígenes (producción).
      origin: env.clientUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 86_400,
    }),
  );

  // 1MB alcanza: las fotos del vehículo van presignadas al storage, no por acá.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  // No bloquea: las rutas públicas (health, catálogo) pasan igual y las privadas
  // exigen requireAuth más adelante.
  app.use(authenticate);

  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        service: 'spiritapex-api',
        version: '0.1.0',
        socketPath: '/socket.io',
      },
    });
  });

  app.use('/api', apiRouter());

  // Después de /api para que el 404 de la API no se coma estas rutas.
  app.use('/', docsRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
