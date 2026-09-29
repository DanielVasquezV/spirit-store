import { bootstrap } from './server.js';

// Solo el entrypoint: la composición del servidor vive en server.ts, así
// dist/index.js sigue siendo el binario que invoca entrypoint.sh.
bootstrap().catch((err: unknown) => {
  console.error('[server] no se pudo arrancar la API:', err);
  process.exit(1);
});
