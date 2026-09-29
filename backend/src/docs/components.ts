// Componentes reutilizables, aparte de los paths: el envelope, los errores y la
// autenticación se definen una sola vez acá y no en 11 operaciones.
//
// Los ejemplos son reales, capturados contra la API corriendo.

export const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: [
      'Token devuelto por `POST /api/auth/register` o `POST /api/auth/login`.',
      '',
      'Enviarlo como `Authorization: Bearer <accessToken>`.',
      'El JWT lleva `{ sub, email, role }` y expira según `JWT_EXPIRES_IN` (7 días por defecto).',
      '',
      'En Swagger UI se puede pegar el token directo en el campo Authorize.',
    ].join('\n'),
  },
} as const;

/** Envoltura de éxito. Toda respuesta 2xx la usa. */
export const successEnvelope = (dataRef: string, description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true], example: true },
          data: { $ref: dataRef },
        },
      },
    },
  },
});

/** 204: el único éxito sin cuerpo. */
export const noContentResponse = (description: string) => ({
  description,
});

// El cliente decide por `code`, que es estable; `message` está en español y
// puede cambiar.
export const errorResponse = (code: string, description: string, details?: unknown) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      examples: {
        [code]: {
          summary: code,
          value: {
            success: false,
            error: { code, message: description, ...(details ? { details } : {}) },
          },
        },
      },
    },
  },
});

export const errorSchemas = {
  Error: {
    type: 'object',
    required: ['success', 'error'],
    properties: {
      success: { type: 'boolean', enum: [false], example: false },
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: {
            type: 'string',
            description: 'Código estable. El cliente decide por este campo, no por `message`.',
            enum: [
              'VALIDATION_ERROR',
              'UNAUTHENTICATED',
              'FORBIDDEN',
              'NOT_FOUND',
              'CONFLICT',
              'UNSUPPORTED_MEDIA_TYPE',
              'RATE_LIMITED',
              'UPLOAD_UNAVAILABLE',
              'UPLOAD_FAILED',
              'INTERNAL_ERROR',
            ],
          },
          message: {
            type: 'string',
            description: 'Texto legible en español. Puede cambiar sin romper clientes.',
            example: 'Validation failed',
          },
          details: {
            description:
              'Contexto del error. En VALIDATION_ERROR es un objeto campo -> mensaje, que la app pinta debajo de cada input. En otros códigos puede ser un string o un objeto libre.',
            oneOf: [
              {
                type: 'object',
                additionalProperties: { type: 'string' },
                example: { email: 'El correo electrónico es obligatorio', phone: 'Ingresá un número de teléfono válido' },
              },
              { type: 'string' },
            ],
          },
        },
      },
    },
  },

  ValidationError: {
    allOf: [
      { $ref: '#/components/schemas/Error' },
      {
        type: 'object',
        properties: {
          error: {
            properties: {
              code: { type: 'string', enum: ['VALIDATION_ERROR'] },
              details: {
                type: 'object',
                description: 'Mensaje por campo. Todas las claves de la petición se reportan a la vez, no solo el primer error.',
                additionalProperties: { type: 'string' },
              },
            },
          },
        },
      },
    ],
  },

  Role: {
    type: 'string',
    enum: ['BUYER', 'SELLER', 'ADMIN'],
    description: [
      'Perfil de la cuenta.',
      '',
      '- `BUYER` y `SELLER` **no son excluyentes**: un vendedor también compra. El usuario puede cambiar entre ambos desde `PATCH /api/auth/me`.',
      '- `ADMIN` **nunca** se autogenera desde el perfil: lo asigna otro ADMIN desde la administración de usuarios.',
      '',
      'El modelo guarda un solo rol por usuario, así que hoy un BUYER que pasa a SELLER deja de figurar como BUYER.',
    ].join('\n'),
  },

  // Lo que ve cualquier autenticado. Sin phoneNumber ni duiPhotoUrl: el
  // contacto va por chat y estos endpoints se pueden leer en bucle.
  PublicUser: {
    type: 'object',
    required: ['id', 'email', 'fullName', 'role', 'isActive', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'uuid', example: '1cab9c68-0f8f-4e7f-9a20-0ef51b37ac30' },
      email: { type: 'string', format: 'email', example: 'ana@spirit.dev' },
      fullName: { type: 'string', minLength: 3, example: 'Ana Test' },
      role: { $ref: '#/components/schemas/Role' },
      isActive: { type: 'boolean', example: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  // El propio usuario, con sus datos de contacto. El passwordHash no se expone
  // nunca.
  SelfUser: {
    allOf: [
      { $ref: '#/components/schemas/PublicUser' },
      {
        type: 'object',
        required: ['phoneNumber'],
        properties: {
          phoneNumber: {
            type: 'string',
            nullable: true,
            description:
              'Se acepta como `phone` o `phoneNumber` en la entrada; la API siempre responde `phoneNumber`.',
            example: '+54 9 11 1234-5678',
          },
          duiPhotoUrl: {
            type: 'string',
            nullable: true,
            format: 'uri',
            description:
              'Solo puede ser una URL de Cloudinary: cualquier otro host se rechaza con 400. Es el documento que acredita que el vendedor es el dueño.',
            example: 'https://res.cloudinary.com/ykbpglzh/image/upload/v1/spiritapex/dui/x.jpg',
          },
        },
      },
    ],
  },

  Session: {
    type: 'object',
    required: ['user', 'accessToken', 'tokenType', 'expiresIn'],
    properties: {
      user: { $ref: '#/components/schemas/SelfUser' },
      accessToken: { type: 'string', description: 'JWT para `Authorization: Bearer`.' },
      tokenType: { type: 'string', enum: ['Bearer'] },
      expiresIn: { type: 'string', example: '7d', description: 'Vigencia del token, en notación de duración.' },
    },
  },

  RegisterRequest: {
    type: 'object',
    required: ['email', 'password', 'fullName', 'phone'],
    description:
      'Los errores de validación devuelven la clave `phone` aunque el cliente haya mandado `phoneNumber`, porque es la que usa el formulario.',
    properties: {
      email: { type: 'string', format: 'email', example: 'ana@spirit.dev' },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 72,
        description:
          '8 caracteres mínimo, 72 **bytes** máximo (límite de bcrypt). Más larga se trunca en silencio y dos contraseñas distintas darían el mismo hash.',
        example: 'Correcto1!',
      },
      fullName: { type: 'string', minLength: 3, example: 'Ana Test' },
      phone: {
        type: 'string',
        description:
          'Alias de `phoneNumber`. Acepta paréntesis, espacios, `+` y guiones, y es más permisiva que la del formulario para no rechazar algo que la app ya dio por bueno. Entre 6 y 25 caracteres.',
        example: '+54 9 11 1234-5678',
      },
      phoneNumber: {
        type: 'string',
        description: 'Alias equivalente a `phone`. Si vienen los dos, manda `phoneNumber`.',
        example: '+54 9 11 1234-5678',
      },
    },
  },

  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'ana@spirit.dev' },
      password: { type: 'string', minLength: 8, example: 'Correcto1!' },
    },
  },

  UpdateMeRequest: {
    type: 'object',
    description:
      'Todos los campos son opcionales. Los que no se mandan quedan intactos: un PATCH parcial nunca borra lo que no nombra.',
    properties: {
      fullName: { type: 'string', minLength: 3, example: 'Ana Test Actualizada' },
      phoneNumber: { type: 'string', description: 'Nuevo teléfono, mismo formato que en el registro.', example: '(11) 4321-1234' },
      phone: { type: 'string', description: 'Alias de `phoneNumber`.' },
      duiPhotoUrl: { type: 'string', format: 'uri', example: 'https://res.cloudinary.com/ykbpglzh/image/upload/v1/spiritapex/dui/x.jpg' },
      role: {
        type: 'string',
        enum: ['BUYER', 'SELLER'],
        description:
          'Solo los roles de cliente. Mandar `ADMIN` responde **403**: el rol se sube desde la administración de usuarios, no desde el perfil propio.',
      },
    },
  },

  CreateUserRequest: {
    type: 'object',
    required: ['email', 'password', 'fullName'],
    properties: {
      email: { type: 'string', format: 'email', example: 'nuevo@spirit.dev' },
      password: { type: 'string', minLength: 8, maxLength: 72, example: 'Generada1!' },
      fullName: { type: 'string', minLength: 3, example: 'Creado Por Admin' },
      phoneNumber: { type: 'string', example: '+54 9 11 1234-5678' },
    },
    description:
      'Aplica las mismas reglas que el registro público: 8 caracteres mínimo y 72 **bytes** máximo, el tope de bcrypt.',
  },

  UploadKind: {
    type: 'string',
    enum: ['vehicles', 'dui', 'chat', 'misc'],
    description:
      'Destino del archivo. Decide la carpeta dentro de Cloudinary y es una lista blanca: cualquier otro valor se rechaza con 400, para que nadie pueda escribir rutas arbitrarias en el nombre del asset. Si se omite, es `misc`.',
  },

  SignedUploadParams: {
    type: 'object',
    required: ['timestamp', 'signature', 'apiKey', 'cloudName', 'folder', 'transformation'],
    description:
      'Credenciales de una sola subida directa. `apiSecret` **nunca** se devuelve: viaja solo la API key pública.',
    properties: {
      timestamp: { type: 'integer', description: 'Unix epoch en segundos.', example: 1790712099 },
      signature: { type: 'string', description: 'HMAC de los parametros firmados.' },
      apiKey: { type: 'string', description: 'API key pública de Cloudinary.', example: '193424885932522' },
      cloudName: { type: 'string', example: 'ykbpglzh' },
      folder: { type: 'string', description: 'Carpeta de destino ya resuelta.', example: 'spiritapex/vehicles' },
      transformation: {
        type: 'string',
        description:
          'Transformación a aplicar en la subida. Va serializada en un solo componente. La firma cubre exactamente este valor: si el cliente lo cambia, Cloudinary rechaza la subida con 400.',
        example: 'c_limit,f_auto,h_2000,q_auto,w_2000',
      },
      expiresAt: {
        type: 'integer',
        description:
          'Unix epoch. **Informativo**: la firma solo cubre `timestamp` y Cloudinary no la invalida por antigüedad, así que lo respeta el cliente por su cuenta.',
        example: 1790712399,
      },
    },
  },

  UploadedAsset: {
    type: 'object',
    required: ['url', 'publicId', 'width', 'height', 'bytes', 'format', 'resourceType'],
    description:
      'Guardar el `publicId`, no la `url`. La URL puede llevar transformaciones y no permite derivar el asset de forma fiable; el `publicId` sí, y es lo que hace falta para borrar.',
    properties: {
      url: { type: 'string', format: 'uri', example: 'https://res.cloudinary.com/ykbpglzh/image/upload/v1/spiritapex/vehicles/u/1790-a3w6d5w0.png' },
      publicId: {
        type: 'string',
        description: 'Identificador del asset, con la carpeta incluida. No lleva extensión: Cloudinary la agrega al servir.',
        example: 'spiritapex/vehicles/4aebb21f-ecb5-46c8-8d88-783278512ae2/1790712099661-a3w6d5w0',
      },
      width: { type: 'integer', nullable: true, example: 1 },
      height: { type: 'integer', nullable: true, example: 1 },
      bytes: { type: 'integer', example: 95 },
      format: { type: 'string', example: 'png' },
      resourceType: { type: 'string', enum: ['image', 'raw', 'video'], example: 'image' },
    },
  },

  Health: {
    type: 'object',
    required: ['service', 'status', 'uptime'],
    properties: {
      service: { type: 'string', example: 'spiritapex-api' },
      status: { type: 'string', enum: ['ok'], example: 'ok' },
      uptime: { type: 'number', description: 'Segundos desde que arrancó el proceso.', example: 187.12 },
    },
  },
} as const;
