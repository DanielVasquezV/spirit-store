import {
  errorResponse,
  errorSchemas,
  noContentResponse,
  paginatedEnvelope,
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
  '/api/vehicles': {
    get: {
      tags: ['Vehículos'],
      summary: 'Listar el catálogo',
      description: [
        'Catálogo público: se puede consultar sin sesión. Solo se listan vehículos',
        '`AVAILABLE` o `IN_AUCTION`; los `DRAFT` (publicaciones sin terminar) y los',
        'dados de baja no aparecen.',
        '',
        'Se pagina y se filtra en la base, no en el cliente. `q` busca en marca y',
        'modelo, ignorando mayúsculas y acentos: "PORSCHE" encuentra "Porsche" y',
        '"skoda" encuentra "Škoda".',
      ].join('\n'),
      security: [],
      parameters: [
        { name: 'q', in: 'query', required: false, schema: { type: 'string' }, description: 'Texto libre sobre marca y modelo.', example: 'porsche' },
        { name: 'category', in: 'query', required: false, schema: { $ref: '#/components/schemas/Category' } },
        { name: 'fuel', in: 'query', required: false, schema: { $ref: '#/components/schemas/Fuel' } },
        { name: 'transmission', in: 'query', required: false, schema: { $ref: '#/components/schemas/Transmission' } },
        { name: 'saleType', in: 'query', required: false, schema: { $ref: '#/components/schemas/SaleType' } },
        { name: 'status', in: 'query', required: false, schema: { $ref: '#/components/schemas/VehicleStatus' } },
        { name: 'minPrice', in: 'query', required: false, schema: { type: 'number' } },
        { name: 'maxPrice', in: 'query', required: false, schema: { type: 'number' } },
        { name: 'sellerId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
        { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      ],
      responses: {
        200: paginatedEnvelope('#/components/schemas/Vehicle', 'Página del catálogo.'),
        400: errorResponse('VALIDATION_ERROR', 'Validation failed', {
          category: 'category debe ser uno de: SUV, SEDAN, SPORT, ELECTRIC, PICKUP, COMPACT',
        }),
      },
    },
    post: {
      tags: ['Vehículos'],
      summary: 'Publicar un vehículo',
      description: [
        'Alta de una publicación. El `sellerId` sale del token, nunca del cuerpo.',
        '',
        '**Requiere el DUI cargado en el perfil**: es la regla de la plataforma para',
        'enlistar (ver `db-er.mermaid`). Si falta, responde 400.',
        '',
        'Si `saleType` es `AUCTION` hay que mandar el bloque `auction` con',
        '`startingPrice` y `endTime`; la subasta se crea en la misma operación y el',
        'vehículo queda `IN_AUCTION`. Las fotos se suben antes con',
        '`/uploads/sign` y acá solo se referencian por URL de Cloudinary.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateVehicleRequest' },
            examples: {
              subasta: {
                summary: 'Vehículo que entra a subasta',
                value: {
                  vin: '1HGBH41JXMN109186', licensePlate: 'P-345ABC', brand: 'Porsche', model: '911',
                  year: 2021, mileage: 12000, transmission: 'AUTOMATIC', fuel: 'GASOLINE', category: 'SPORT',
                  engine: '3.0L Boxer Turbo', power: '385 HP', drivetrain: 'RWD', basePrice: 128500,
                  saleType: 'AUCTION', auction: { startingPrice: 120000, endTime: '2026-10-10T18:00:00.000Z' },
                },
              },
            },
          },
        },
      },
      responses: {
        201: successEnvelope('#/components/schemas/Vehicle', 'Vehículo publicado.'),
        400: errorResponse('VALIDATION_ERROR', 'Validation failed', {
          duiPhotoUrl: 'El DUI es obligatorio para publicar',
        }),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        409: errorResponse('CONFLICT', 'A record with the same unique value already exists', { fields: ['vin'] }),
      },
    },
  },

  '/api/vehicles/mine': {
    get: {
      tags: ['Vehículos'],
      summary: 'Mis publicaciones',
      description:
        'Vehículos del usuario autenticado, **incluidos los `DRAFT`**. Acepta los mismos filtros que el catálogo, salvo que el `sellerId` es forzosamente el propio.',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'status', in: 'query', required: false, schema: { $ref: '#/components/schemas/VehicleStatus' } },
        { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      ],
      responses: {
        200: paginatedEnvelope('#/components/schemas/Vehicle', 'Página con las publicaciones propias.'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
      },
    },
  },

  '/api/vehicles/{id}': {
    get: {
      tags: ['Vehículos'],
      summary: 'Ver un vehículo',
      description:
        'Público. Si el vehículo está en `DRAFT`, solo lo ven su dueño y un ADMIN; para el resto responde 404, para no confirmar que el id existe.',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: successEnvelope('#/components/schemas/Vehicle', 'Vehículo encontrado.'),
        404: errorResponse('NOT_FOUND', 'Vehicle not found'),
      },
    },
    patch: {
      tags: ['Vehículos'],
      summary: 'Editar un vehículo',
      description: [
        'Solo el vendedor que lo publicó o un ADMIN. PATCH parcial: lo que no se',
        'manda queda intacto.',
        '',
        '`status` solo alterna entre `DRAFT` y `AVAILABLE`. `IN_AUCTION` y `SOLD`',
        'los maneja la API (subasta y cierre de venta), así que mandarlos es un',
        '400; y si el vehículo tiene una subasta `PENDING` o `ACTIVE` el cambio',
        'es un 409 porque la subasta manda sobre su estado.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateVehicleRequest' } } },
      },
      responses: {
        200: successEnvelope('#/components/schemas/Vehicle', 'Vehículo actualizado.'),
        400: errorResponse('VALIDATION_ERROR', 'Validation failed'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        403: errorResponse('FORBIDDEN', 'Solo el vendedor que publico el vehiculo puede modificarlo'),
        404: errorResponse('NOT_FOUND', 'Vehicle not found'),
        409: errorResponse('CONFLICT', 'El vehiculo tiene una subasta en curso: cancelala antes de cambiar el estado'),
      },
    },
    delete: {
      tags: ['Vehículos'],
      summary: 'Dar de baja un vehículo',
      description: [
        'Borrado **lógico**: la fila queda con `deletedAt`, porque chats, órdenes y',
        'pujas la referencian y su historial tiene que seguir resolviendo. La',
        'subasta asociada, si estaba `PENDING` o `ACTIVE`, se cancela en la misma',
        'transacción.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        204: noContentResponse('Vehículo dado de baja.'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        403: errorResponse('FORBIDDEN', 'Solo el vendedor que publico el vehiculo puede modificarlo'),
        404: errorResponse('NOT_FOUND', 'Vehicle not found'),
      },
    },
  },

  '/api/vehicles/{id}/images': {
    post: {
      tags: ['Vehículos'],
      summary: 'Agregar una foto a la galería',
      description: [
        'La foto se sube antes directa a Cloudinary con `/api/uploads/sign` y acá se',
        'asocia al vehículo. Guardar el `publicId` es lo que permite borrarla del',
        'proveedor después. Si no se manda `position`, la foto va al final de la',
        'galería.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['url'],
              properties: {
                url: { type: 'string', format: 'uri', description: 'Debe ser una URL de Cloudinary.' },
                publicId: { type: 'string' },
                position: { type: 'integer', description: '0 es la portada.' },
              },
            },
          },
        },
      },
      responses: {
        201: successEnvelope('#/components/schemas/Vehicle', 'Vehículo con la nueva foto.'),
        400: errorResponse('VALIDATION_ERROR', 'La imagen debe venir de Cloudinary'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        403: errorResponse('FORBIDDEN', 'Solo el vendedor que publico el vehiculo puede modificarlo'),
        404: errorResponse('NOT_FOUND', 'Vehicle not found'),
      },
    },
  },

  '/api/vehicles/{id}/images/{imageId}': {
    delete: {
      tags: ['Vehículos'],
      summary: 'Quitar una foto de la galería',
      description: [
        'Solo el dueño del vehículo o un ADMIN. Si la foto se había guardado con',
        '`publicId`, también se intenta borrar el asset de Cloudinary; si esa',
        'llamada falla la foto igual sale de la galería, porque dejar la foto pegada',
        'sería peor que dejar un asset huérfano.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        { name: 'imageId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        204: noContentResponse('Foto quitada de la galería.'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        403: errorResponse('FORBIDDEN', 'Solo el vendedor que publico el vehiculo puede modificarlo'),
        404: errorResponse('NOT_FOUND', 'Vehicle image not found'),
      },
    },
  },

  '/api/auctions': {
    get: {
      tags: ['Subastas'],
      summary: 'Listar subastas',
      description: 'Público. Se ordenan por `endTime` ascendente: las que cierran antes primero. No incluye subastas de vehículos dados de baja.',
      security: [],
      parameters: [
        { name: 'status', in: 'query', required: false, schema: { $ref: '#/components/schemas/AuctionStatus' } },
        { name: 'sellerId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
        { name: 'vehicleId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
        { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      ],
      responses: {
        200: paginatedEnvelope('#/components/schemas/Auction', 'Página de subastas.'),
        400: errorResponse('VALIDATION_ERROR', 'Validation failed'),
      },
    },
    post: {
      tags: ['Subastas'],
      summary: 'Programar una subasta',
      description: [
        'Para un vehículo propio que todavía **no** tenga subasta (habitualmente uno',
        '`BOTH` que se decide subastar después). También sirve para un vehículo',
        'creado sin bloque `auction`.',
        '',
        'Un vehículo `DIRECT_SALE` se rechaza: no admite subasta. Si ya tiene una',
        'subasta, responde 409. El vehículo pasa a `IN_AUCTION`.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAuctionRequest' } } },
      },
      responses: {
        201: successEnvelope('#/components/schemas/Auction', 'Subasta programada.'),
        400: errorResponse('VALIDATION_ERROR', 'El vehiculo esta marcado como venta directa y no admite subasta'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        403: errorResponse('FORBIDDEN', 'Solo el vendedor puede subastar su vehiculo'),
        404: errorResponse('NOT_FOUND', 'Vehicle not found'),
        409: errorResponse('CONFLICT', 'El vehiculo ya tiene una subasta asociada'),
      },
    },
  },

  '/api/auctions/{id}': {
    get: {
      tags: ['Subastas'],
      summary: 'Ver una subasta',
      description: 'Público. Incluye el vehículo, el vendedor, el ganador actual y las últimas 10 pujas (solo lectura).',
      security: [],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: successEnvelope('#/components/schemas/Auction', 'Subasta encontrada.'),
        404: errorResponse('NOT_FOUND', 'Auction not found'),
      },
    },
    patch: {
      tags: ['Subastas'],
      summary: 'Editar una subasta programada',
      description: 'Solo mientras esté `PENDING`. Una vez que la subasta arrancó, mover precio o fechas reescribiría la historia de las pujas, así que responde 409.',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateAuctionRequest' } } },
      },
      responses: {
        200: successEnvelope('#/components/schemas/Auction', 'Subasta actualizada.'),
        400: errorResponse('VALIDATION_ERROR', 'startTime debe ser anterior a endTime'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        403: errorResponse('FORBIDDEN', 'Solo el vendedor de la subasta puede modificarla'),
        404: errorResponse('NOT_FOUND', 'Auction not found'),
        409: errorResponse('CONFLICT', 'Solo se puede editar una subasta que todavia no empezo'),
      },
    },
    delete: {
      tags: ['Subastas'],
      summary: 'Cancelar una subasta',
      description:
        'Marca la subasta `CANCELLED` y devuelve el vehículo al catálogo (`AVAILABLE`). Una subasta `FINISHED` no se puede cancelar.',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        204: noContentResponse('Subasta cancelada.'),
        401: errorResponse('UNAUTHENTICATED', 'Authentication required'),
        403: errorResponse('FORBIDDEN', 'Solo el vendedor de la subasta puede modificarla'),
        404: errorResponse('NOT_FOUND', 'Auction not found'),
        409: errorResponse('CONFLICT', 'Una subasta finalizada no se puede cancelar'),
      },
    },
  },
} as const;

export { errorSchemas, securitySchemes };
