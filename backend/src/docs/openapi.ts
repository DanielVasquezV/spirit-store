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
      'Cubierto hoy: `health`, `auth` (registro/login/perfil), `uploads` (firma,',
      'subida proxy, borrado), lectura y alta de usuarios, y los dominios de',
      '**vehículos** (catálogo, publicación, galería) y **subastas** (programar,',
      'consultar, editar, cancelar, **pujar**, historial de pujas y cierre automático).',
      '',
      '**Pujas.** `POST /auctions/{id}/bids` valida y escribe la puja en una',
      'transacción con `SELECT ... FOR UPDATE` sobre la fila de la subasta, de modo',
      'que dos pujas simultáneas se serializan y solo una puede ganar por el mismo',
      'monto. El monto se compara en centavos enteros. La escritura emite',
      '`auction:bid-placed` a la sala de la subasta y `auction:outbid` a la sala',
      'personal de quien quedó desplazado; quien puja pasa primero por',
      '`auction:join`.',
      '',
      '**Cierre automático.** Un timer corre cada 15s: activa las subastas cuya',
      '`startTime` ya pasó y cierra las cuya `endTime` ya venció, fijando el',
      'ganador y dejando el vehículo `SOLD`. Una subasta que vence sin pujas devuelve',
      'el vehículo a `AVAILABLE`. Sin este timer el estado solo avanzaría cuando',
      'alguien mirara la subasta, y nadie mira una que ya terminó.',
      '',
      '**Lo que falta**: órdenes y pagos, chat y diagnóstico por IA siguen sin',
      'endpoints, aunque el esquema ya los contempla. Tampoco hay favoritos,',
      'refresh token ni rate limiting.',
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
    { name: 'Vehículos', description: 'Catálogo, publicación de vehículos y galería de fotos.' },
    { name: 'Subastas', description: 'Programar y seguir subastas, pujar y consultar el historial de pujas.' },
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
