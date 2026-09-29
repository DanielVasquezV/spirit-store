import {
  errorResponse,
  errorSchemas,
  noContentResponse,
  securitySchemes,
  successEnvelope,
} from './components.js';

// Cada operación declara el status real que devuelve el servidor, no el ideal:
// crear es 201, borrar es 204. Poner 200 ahí hace que el cliente mal escrito
// nunca falle en local.
export const paths = {
  '/': {
    get: {
      tags: ['Sistema'],
      summary: 'Información del servicio',
      description:
        'Raíz del servidor, fuera de `/api`. Devuelve nombre, versión y la ruta del socket de WebSocket. Cumple la misma función que un health check; para monitorear conviene `/api/health`, que además expone el uptime.',
      security: [],
      responses: {
        200: {
          description: 'Información del servicio.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data'],
                properties: {
                  success: { type: 'boolean', enum: [true] },
                  data: {
                    type: 'object',
                    required: ['service', 'version', 'socketPath'],
                    properties: {
                      service: { type: 'string', example: 'spiritapex-api' },
                      version: { type: 'string', example: '0.1.0' },
                      socketPath: { type: 'string', example: '/socket.io' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  '/api/health': {
    get: {
      tags: ['Sistema'],
      summary: 'Estado del servicio',
      description:
        'No requiere autenticación. Útil para health checks de un balanceador o del propio arranque de la app móvil.',
      security: [],
      responses: {
        200: successEnvelope('#/components/schemas/Health', 'El servicio está arriba.'),
      },
    },
  },

  '/api/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Crear cuenta',
      description: [
        'Alta pública. Devuelve la sesión ya iniciada, así que la app no necesita un',
        'segundo round-trip a `/auth/login` después de registrarse.',
        '',
        'El **rol lo fija el servidor** en `BUYER`. Este endpoint ignora cualquier',
        '`role` que venga en el body: aceptarlo sería una vía de autoasignación de ADMIN.',
      ].join('\n'),
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RegisterRequest' },
            examples: {
              conAliasPhone: {
                summary: 'Con el alias `phone` que usa el formulario de la app',
                value: { email: 'ana@spirit.dev', password: 'Correcto1!', fullName: 'Ana Test', phone: '+54 9 11 1234-5678' },
              },
              conPhoneNumber: {
                summary: 'Con `phoneNumber`',
                value: { email: 'ana@spirit.dev', password: 'Correcto1!', fullName: 'Ana Test', phoneNumber: '+54 9 11 1234-5678' },
              },
            },
          },
        },
      },
      responses: {
        201: successEnvelope('#/components/schemas/Session', 'Cuenta creada y sesión iniciada.'),
        400: errorResponse('VALIDATION_ERROR', 'Validation failed', {
          email: 'El correo electrónico es obligatorio',
          phone: 'El número de teléfono es obligatorio',
        }),
        409: errorResponse('CONFLICT', 'A record with the same unique value already exists', {
          fields: ['email'],
        }),
        500: errorResponse('INTERNAL_ERROR', 'Error interno'),
      },
    },
  },

  '/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Iniciar sesión',
      description: [
        'Contraseña incorrecta y correo inexistente devuelven **exactamente el mismo',
        '401 y el mismo mensaje**, para que el endpoint no sirva para enumerar',
        'qué correos están registrados. Cuando el correo no existe se compara igual',
        'contra un hash bcrypt ficticio, para que tampoco se distinga por el tiempo',
        'de respuesta.',
        '',
        'Una cuenta desactivada responde 403 con un mensaje que invita a contactar',
        'al soporte.',
      ].join('\n'),
      security: [],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
      },
      responses: {
        200: successEnvelope('#/components/schemas/Session', 'Sesión iniciada.'),
        400: errorResponse('VALIDATION_ERROR', 'Validation failed'),
        401: errorResponse('UNAUTHENTICATED', 'Correo o contraseña incorrectos'),
        403: errorResponse('FORBIDDEN', 'La cuenta está desactivada. Contacta al soporte.'),
      },
    },
  },

  '/api/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Perfil propio',
      description: 'Devuelve la vista extendida del usuario: incluye `phoneNumber` y `duiPhotoUrl`. Nunca el `passwordHash`.',
      security: [{ bearerAuth: [] }],
      responses: {
        200: successEnvelope('#/components/schemas/SelfUser', 'Perfil del usuario autenticado.'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
      },
    },
    patch: {
      tags: ['Auth'],
      summary: 'Editar perfil propio',
      description: [
        'Campos opcionales. Los que no se mandan quedan intactos.',
        '',
        '**El id sale siempre del token**, nunca del cuerpo: nadie puede editar a otro.',
        '',
        'Dos restricciones a propósito:',
        '- `role: "ADMIN"` responde **403**. Un usuario no puede elevarse a sí mismo; el',
        '  cambio de rol de cliente (BUYER <-> SELLER) si se permite porque es una',
        '  decisión del usuario.',
        '- `phoneNumber: ""` o `null` responde **400**. El teléfono no se puede vaciar',
        '  porque el contacto entre partes se resuelve por chat.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateMeRequest' },
            examples: {
              datos: { summary: 'Nombre y teléfono', value: { fullName: 'Ana Actualizada', phoneNumber: '(11) 4321-1234' } },
              aVendedor: { summary: 'Marcar la cuenta como vendedora', value: { role: 'SELLER' } },
            },
          },
        },
      },
      responses: {
        200: successEnvelope('#/components/schemas/SelfUser', 'Perfil actualizado.'),
        400: errorResponse('VALIDATION_ERROR', 'Validation failed', {
          duiPhotoUrl: 'La URL del DUI debe venir de Cloudinary',
        }),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        403: errorResponse('FORBIDDEN', 'El rol ADMIN no se puede autogenerar desde el perfil'),
        404: errorResponse('NOT_FOUND', 'User not found'),
      },
    },
  },

  '/api/uploads/sign': {
    post: {
      tags: ['Uploads'],
      summary: 'Firmar una subida directa a Cloudinary',
      description: [
        'Devuelve los parámetros para que el móvil suba **directo** a Cloudinary sin',
        'que el archivo pase por la API. Es la vía recomendada para galerías de',
        'vehículo: la foto no vuelve a viajar por el backend, que en móvil significa',
        'gastar datos del usuario y RAM del servidor.',
        '',
        '**Cómo usarlo:** `POST` a `https://api.cloudinary.com/v1_1/{cloudName}/image/upload`',
        'con `multipart/form-data` y exactamente estos campos: `file`, `api_key`,',
        '`timestamp`, `signature`, `folder`, `transformation`.',
        '',
        'La firma cubre `timestamp`, `folder` y `transformation`. Si el cliente cambia',
        'alguno de esos tres al subir, Cloudinary rechaza la petición con 400. El',
        '`apiSecret` nunca sale del backend.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['kind'],
              properties: {
                kind: { $ref: '#/components/schemas/UploadKind' },
                contentType: {
                  type: 'string',
                  description: 'Informativo, no se usa para firmar.',
                  example: 'image/jpeg',
                },
              },
            },
            examples: {
              vehiculo: { summary: 'Foto de vehículo', value: { kind: 'vehicles', contentType: 'image/jpeg' } },
            },
          },
        },
      },
      responses: {
        200: successEnvelope('#/components/schemas/SignedUploadParams', 'Firma generada.'),
        400: errorResponse('VALIDATION_ERROR', 'kind debe ser uno de: vehicles, dui, chat, misc'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        503: errorResponse('UPLOAD_UNAVAILABLE', 'El servicio de subida de archivos no está configurado (revise CLOUDINARY_URL)'),
      },
    },
  },

  '/api/uploads': {
    post: {
      tags: ['Uploads'],
      summary: 'Subir un archivo a través de la API',
      description: [
        'Subida **proxy**: el archivo viaja en el multipart y sale de aquí. Es la vía',
        'simple, para el DUI o adjuntos de chat. Para galerías de vehículo conviene',
        '`/uploads/sign` + subida directa.',
        '',
        'El archivo se guarda ya transformado (`q_auto`, `f_auto`, 2000x2000 con',
        '`c_limit`) para no depender de Cloudinary en caliente al mostrar imágenes.',
        '',
        'MIME aceptados: `image/jpeg`, `image/png`, `image/webp`, `image/heic`,',
        '`image/heif`, `application/pdf`. El filtro se basa en el MIME declarado,',
        'no en los bytes: Cloudinary es quien valida y transcodea el contenido real.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: {
                file: { type: 'string', format: 'binary', description: 'El archivo. Exactamente uno por petición.' },
                kind: { $ref: '#/components/schemas/UploadKind' },
              },
            },
          },
        },
      },
      responses: {
        201: successEnvelope('#/components/schemas/UploadedAsset', 'Archivo subido.'),
        400: errorResponse('VALIDATION_ERROR', "Falta el archivo en el campo 'file'"),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        415: errorResponse('UNSUPPORTED_MEDIA_TYPE', 'Tipo de archivo no permitido: application/x-sh'),
        502: errorResponse('UPLOAD_FAILED', 'Cloudinary rechazó la subida'),
        503: errorResponse('UPLOAD_UNAVAILABLE', 'El servicio de subida de archivos no está configurado (revise CLOUDINARY_URL)'),
      },
    },
    delete: {
      tags: ['Uploads'],
      summary: 'Eliminar un archivo',
      description: [
        'El `publicId` va **por query, no por path**: contiene barras',
        '(`spiritapex/vehicles/<userId>/<ts>-<rand>`) y Express no deja pasar barras',
        'en un `:param` de un solo segmento. Encoding normal con `encodeURIComponent`.',
        '',
        'El `publicId` se valida contra la carpeta esperada y se rechazan los `..`,',
        'así que un usuario autenticado no puede borrar assets de otro proyecto.',
        '',
        'Es **idempotente**: borrar algo ya borrado responde 204 igual, porque la app',
        'reintenta cuando se le corta la red.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'publicId',
          in: 'query',
          required: true,
          description: 'Identificador del asset, tal como lo devolvió la subida.',
          schema: { type: 'string' },
          example: 'spiritapex/vehicles/4aebb21f-ecb5-46c8-8d88-783278512ae2/1790712099661-a3w6d5w0',
        },
        {
          name: 'kind',
          in: 'query',
          required: false,
          description:
            'Si se indica, el asset tiene que estar en esa carpeta. Si se omite, basta con que esté dentro de la carpeta raíz de la app.',
          schema: { $ref: '#/components/schemas/UploadKind' },
        },
      ],
      responses: {
        204: noContentResponse('Asset eliminado (o ya estaba borrado).'),
        400: errorResponse('VALIDATION_ERROR', 'Falta el query param publicId'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        403: errorResponse('FORBIDDEN', 'El asset no pertenece a esta carpeta de la aplicación'),
        502: errorResponse('UPLOAD_FAILED', 'No se pudo eliminar el archivo'),
        503: errorResponse('UPLOAD_UNAVAILABLE', 'El servicio de subida de archivos no está configurado (revise CLOUDINARY_URL)'),
      },
    },
  },

  '/api/users': {
    get: {
      tags: ['Usuarios'],
      summary: 'Listar usuarios (ADMIN)',
      description: [
        'Devuelve la vista **pública** de cada usuario: sin `passwordHash`, sin',
        '`phoneNumber` y sin `duiPhotoUrl`.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Lista de usuarios.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data'],
                properties: {
                  success: { type: 'boolean', enum: [true] },
                  data: { type: 'array', items: { $ref: '#/components/schemas/PublicUser' } },
                },
              },
            },
          },
        },
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        403: errorResponse('FORBIDDEN', 'Insufficient permissions'),
      },
    },
    post: {
      tags: ['Usuarios'],
      summary: 'Crear usuario (ADMIN)',
      description:
        'Alta hecha por un administrador. El `role` del body se **ignora**: la cuenta nace en `BUYER`. Si se necesita un ADMIN, se asigna aparte.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUserRequest' } } },
      },
      responses: {
        201: successEnvelope('#/components/schemas/PublicUser', 'Usuario creado.'),
        400: errorResponse('VALIDATION_ERROR', 'Validation failed', {
          password: 'La contraseña debe tener al menos 8 caracteres',
        }),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        403: errorResponse('FORBIDDEN', 'Insufficient permissions'),
      },
    },
  },

  '/api/users/{id}': {
    get: {
      tags: ['Usuarios'],
      summary: 'Ver un usuario',
      description:
        'Lo puede pedir cualquier usuario autenticado, no solo un ADMIN. Devuelve la vista pública, sin datos de contacto.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'UUID del usuario.',
          schema: { type: 'string', format: 'uuid' },
          example: '1cab9c68-0f8f-4e7f-9a20-0ef51b37ac30',
        },
      ],
      responses: {
        200: successEnvelope('#/components/schemas/PublicUser', 'Usuario encontrado.'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        404: errorResponse('NOT_FOUND', 'User not found'),
      },
    },
  },
} as const;

export { errorSchemas, securitySchemes };
