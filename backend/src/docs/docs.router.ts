import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { env } from '../config/env.js';
import { openApiDocument } from './openapi.js';

// Fuera de /api a propósito: la UI es herramienta de desarrollo, no contrato de
// negocio, así que no debería usar el envelope { success, data }.
//
//   GET /docs      -> Swagger UI
//   GET /docs.json -> el spec crudo, para generadores de cliente o Postman
//
// En producción responden 404 salvo SWAGGER_ENABLED=true.
export function docsRouter(): Router {
  const router = Router();

  if (!env.swaggerEnabled) {
    return router;
  }

  router.get('/docs.json', (_req, res) => {
    res.status(200).json(openApiDocument);
  });

  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'SpiritApex API',
      swaggerOptions: {
        // El server va con url relativa: si el spec se copia a otro host, "Try
        // it out" sigue apuntando al servidor correcto.
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'list',
        tryItOutEnabled: true,
        defaultModelsExpandDepth: 1,
      },
    }),
  );

  return router;
}
