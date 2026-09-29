import { env } from '../config/env.js';
import { errorSchemas, securitySchemes } from './components.js';
import { paths } from './paths.js';

// El contrato va escrito a mano y no generado con decoradores: no hay zod ni
// metadata en los controllers, así que un generador tendría que inventar tipos.
// Escrito a mano obliga a que cada status coincida con lo que hace el servidor, y
// el smoke test avisa si divergen.
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'SpiritApex API',
    version: '0.1.0',
    description: [
      'API del marketplace de vehículos de SpiritApex.',
      '',
      '## Envoltura de respuestas',
      'El éxito es `{ "success": true, "data": ... }` y el error',
      '`{ "success": false, "error": { "code", "message", "details"? } }`.',
      'El `204` es el único código de éxito sin cuerpo.',
      '',
      'El cliente decide por `error.code`, que es estable, y no por',
      '`error.message`, que está en español y puede cambiar. En',
      '`VALIDATION_ERROR`, `details` trae un objeto campo -> mensaje para pintar',
      'debajo de cada input: la app los muestra tal cual.',
      '',
      '## Autenticacion',
      'JWT en `Authorization: Bearer <token>`. Hay dos vistas de usuario y la',
      'distinción importa: `PublicUser` (lo que ve cualquiera) **no** lleva',
      '`phoneNumber` ni `duiPhotoUrl`; `SelfUser` (`/auth/me`) sí. El contacto se',
      'resuelve por chat, no exponiendo datos de contacto en endpoints legibles en',
      'bucle.',
      '',
      '## Estado de esta API',
      'Cubierto hoy: `health`, `auth` (registro/login/perfil) y `uploads`',
      '(firma, subida proxy, borrado), mas lectura y alta de usuarios.',
      'El esquema ya incluye vehículos, subastas, órdenes, chat y',
      'diagnóstico IA, pero **esos endpoints todavía no existen**: las tablas están',
      'migradas y la API no.',
    ].join('\n'),
    contact: { name: 'SpiritApex' },
    license: { name: 'UNLICENSED' },
  },
  servers: [
    // Relativa a propósito: la UI se sirve desde la misma app, así que "Try it
    // out" apunta al host correcto en local y en un despliegue sin editar el
    // spec. Por eso los paths llevan el /api completo.
    { url: '/', description: 'Servidor actual (se resuelve contra el host de esta pagina)' },
  ],
  tags: [
    { name: 'Sistema', description: 'Health checks y estado del servicio.' },
    { name: 'Auth', description: 'Registro, login y perfil propio.' },
    { name: 'Uploads', description: 'Firmas, subida y borrado de archivos en Cloudinary.' },
    { name: 'Usuarios', description: 'Listado y alta de usuarios, restringido a ADMIN.' },
  ],
  security: [{ bearerAuth: [] }],
  paths,
  components: {
    securitySchemes,
    schemas: errorSchemas,
  },
} as const;

export type OpenApiDocument = typeof openApiDocument;

// En producción no se publica salvo SWAGGER_ENABLED=true: la UI deja llamar a
// la API real desde el navegador con un token tecleado a mano.
export function docsEnabled(): boolean {
  return !env.isProduction || env.swaggerEnabled;
}
