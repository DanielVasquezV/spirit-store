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

/** Envoltura de listado paginado. `data` es el arreglo de la página y `meta` trae el conteo. */
export const paginatedEnvelope = (dataRef: string, description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true], example: true },
          data: { type: 'array', items: { $ref: dataRef } },
          meta: {
            type: 'object',
            required: ['page', 'pageSize', 'total', 'totalPages'],
            properties: {
              page: { type: 'integer', example: 1 },
              pageSize: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 42 },
              totalPages: { type: 'integer', example: 3 },
            },
          },
        },
      },
    },
  },
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
              'AI_UNAVAILABLE',
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

  Fuel: {
    type: 'string',
    enum: ['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID'],
    description: 'Combustible. La app lo muestra como "Gasolina", "Diésel", "Eléctrico" o "Híbrido".',
    example: 'GASOLINE',
  },

  Category: {
    type: 'string',
    enum: ['SUV', 'SEDAN', 'SPORT', 'ELECTRIC', 'PICKUP', 'COMPACT'],
    description: 'Segmento comercial, independiente del combustible: un eléctrico es su propia categoría, no un sedán.',
    example: 'SUV',
  },

  Transmission: {
    type: 'string',
    enum: ['MANUAL', 'AUTOMATIC'],
    description: 'La app lo muestra como "Manual" o "Automática".',
    example: 'AUTOMATIC',
  },

  Condition: {
    type: 'string',
    enum: ['NEW', 'LIKE_NEW', 'USED', 'FOR_PARTS'],
    example: 'USED',
  },

  SaleType: {
    type: 'string',
    enum: ['DIRECT_SALE', 'AUCTION', 'BOTH'],
    description: 'La app lo traduce a los badges "Venta directa" y/o "Subasta".',
    example: 'AUCTION',
  },

  VehicleStatus: {
    type: 'string',
    enum: ['DRAFT', 'AVAILABLE', 'IN_AUCTION', 'RESERVED', 'SOLD'],
    description: '`DRAFT` es una publicación sin terminar: solo la ve su dueño, nunca el catálogo público.',
    example: 'IN_AUCTION',
  },

  AuctionStatus: {
    type: 'string',
    enum: ['PENDING', 'ACTIVE', 'FINISHED', 'CANCELLED'],
    description: '`PENDING` es programada (empieza en el futuro); `ACTIVE` es la que la app muestra como "En vivo". `FINISHED` la cierra el timer cuando vence `endTime`, fijando el ganador; `CANCELLED` la marca el vendedor o un ADMIN. Las transiciones las hace el servidor, no el cliente.',
    example: 'ACTIVE',
  },

  VehicleImage: {
    type: 'object',
    required: ['id', 'url', 'position'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      url: { type: 'string', format: 'uri', description: 'URL de Cloudinary, ya transformada. Solo se acepta un host de Cloudinary.' },
      publicId: { type: 'string', nullable: true, description: 'Identificador del asset. Es lo que hace falta para borrarlo de Cloudinary.' },
      position: { type: 'integer', description: 'Orden en la galería. 0 es la portada.' },
    },
  },

  VehicleSeller: {
    type: 'object',
    required: ['id', 'fullName', 'isVerified'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      fullName: { type: 'string' },
      isVerified: { type: 'boolean', description: 'Tiene el DUI cargado, requisito para publicar.' },
    },
  },

  VehicleAuction: {
    type: 'object',
    description: 'Resumen de la subasta del vehículo, para la ficha del catálogo. `null` si el vehículo no está en subasta.',
    required: ['id', 'status', 'startingPrice', 'minBidIncrement', 'startTime', 'endTime'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      status: { $ref: '#/components/schemas/AuctionStatus' },
      startingPrice: { type: 'number' },
      currentBid: { type: 'number', nullable: true },
      minBidIncrement: { type: 'number' },
      startTime: { type: 'string', format: 'date-time' },
      endTime: { type: 'string', format: 'date-time' },
    },
  },

  Vehicle: {
    type: 'object',
    required: ['id', 'sellerId', 'vin', 'licensePlate', 'brand', 'model', 'title', 'year', 'mileage', 'transmission', 'fuel', 'category', 'engine', 'power', 'drivetrain', 'condition', 'basePrice', 'saleType', 'status', 'images', 'seller'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      sellerId: { type: 'string', format: 'uuid' },
      vin: { type: 'string', example: '1HGBH41JXMN109186' },
      licensePlate: { type: 'string', example: 'P-345ABC' },
      brand: { type: 'string', example: 'Porsche' },
      model: { type: 'string', example: '911' },
      title: { type: 'string', description: 'Derivado de `brand` + `model`, listo para pintar como nombre en la card.', example: 'Porsche 911' },
      year: { type: 'integer', example: 2021 },
      mileage: { type: 'integer', description: 'Kilómetros.', example: 12000 },
      transmission: { $ref: '#/components/schemas/Transmission' },
      fuel: { $ref: '#/components/schemas/Fuel' },
      category: { $ref: '#/components/schemas/Category' },
      engine: { type: 'string', description: 'Texto libre, lo publica la marca a su manera.', example: '3.0L Boxer Turbo' },
      power: { type: 'string', example: '385 HP' },
      drivetrain: { type: 'string', example: 'RWD' },
      condition: { $ref: '#/components/schemas/Condition' },
      color: { type: 'string', nullable: true },
      basePrice: { type: 'number', description: 'Precio de referencia para venta directa. La subasta usa su propio `startingPrice`.', example: 128500 },
      saleType: { $ref: '#/components/schemas/SaleType' },
      status: { $ref: '#/components/schemas/VehicleStatus' },
      description: { type: 'string', nullable: true },
      images: { type: 'array', items: { $ref: '#/components/schemas/VehicleImage' } },
      seller: { $ref: '#/components/schemas/VehicleSeller' },
      auction: { nullable: true, allOf: [{ $ref: '#/components/schemas/VehicleAuction' }] },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  CreateVehicleRequest: {
    type: 'object',
    required: ['vin', 'licensePlate', 'brand', 'model', 'year', 'mileage', 'transmission', 'fuel', 'category', 'engine', 'power', 'drivetrain', 'basePrice', 'saleType'],
    description: 'Requiere sesión y el DUI del vendedor cargado en el perfil. Ver `auction` para la forma de la subasta.',
    properties: {
      vin: { type: 'string', minLength: 5, maxLength: 17, example: '1HGBH41JXMN109186' },
      licensePlate: { type: 'string', minLength: 3, maxLength: 12, example: 'P-345ABC' },
      brand: { type: 'string', minLength: 2, maxLength: 40, example: 'Porsche' },
      model: { type: 'string', minLength: 1, maxLength: 60, example: '911' },
      year: { type: 'integer', example: 2021 },
      mileage: { type: 'integer', min: 0, example: 12000 },
      transmission: { $ref: '#/components/schemas/Transmission' },
      fuel: { $ref: '#/components/schemas/Fuel' },
      category: { $ref: '#/components/schemas/Category' },
      engine: { type: 'string', minLength: 1, maxLength: 80, example: '3.0L Boxer Turbo' },
      power: { type: 'string', minLength: 1, maxLength: 80, example: '385 HP' },
      drivetrain: { type: 'string', minLength: 1, maxLength: 80, example: 'RWD' },
      condition: { $ref: '#/components/schemas/Condition' },
      color: { type: 'string', maxLength: 40, example: 'Rojo' },
      basePrice: { type: 'number', description: 'Debe ser mayor a 0.', example: 128500 },
      saleType: { $ref: '#/components/schemas/SaleType' },
      description: { type: 'string', maxLength: 2000 },
      images: {
        type: 'array',
        description: 'Fotos ya subidas con `/api/uploads/sign`. Cada `url` debe ser de Cloudinary.',
        items: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', format: 'uri' },
            publicId: { type: 'string', description: 'Se guarda para poder borrar el asset de Cloudinary después.' },
          },
        },
      },
      auction: {
        type: 'object',
        description: 'Obligatorio si `saleType` es `AUCTION`; prohibido si es `DIRECT_SALE`; opcional en `BOTH`.',
        required: ['startingPrice', 'endTime'],
        properties: {
          startingPrice: { type: 'number', example: 120000 },
          endTime: { type: 'string', format: 'date-time', description: 'Debe ser futura.' },
          startTime: { type: 'string', format: 'date-time', description: 'Si se omite, la subasta arranca de inmediato (queda `ACTIVE`).' },
          minBidIncrement: { type: 'number', example: 10 },
        },
      },
    },
  },

  UpdateVehicleRequest: {
    type: 'object',
    description: 'Todos los campos opcionales; los que no se mandan quedan intactos. Solo el dueño del vehículo o un ADMIN.',
    properties: {
      brand: { type: 'string', minLength: 2, maxLength: 40 },
      model: { type: 'string', minLength: 1, maxLength: 60 },
      year: { type: 'integer' },
      mileage: { type: 'integer', min: 0 },
      transmission: { $ref: '#/components/schemas/Transmission' },
      fuel: { $ref: '#/components/schemas/Fuel' },
      category: { $ref: '#/components/schemas/Category' },
      engine: { type: 'string', minLength: 1, maxLength: 80 },
      power: { type: 'string', minLength: 1, maxLength: 80 },
      drivetrain: { type: 'string', minLength: 1, maxLength: 80 },
      condition: { $ref: '#/components/schemas/Condition' },
      color: { type: 'string', nullable: true },
      basePrice: { type: 'number' },
      status: {
        type: 'string',
        enum: ['DRAFT', 'AVAILABLE'],
        description: [
          'Solo se puede alternar entre borrador y publicado. `IN_AUCTION` lo',
          'maneja el ciclo de vida de la subasta y `SOLD` el cierre de venta, así',
          'que mandarlos responde 400. Mientras haya una subasta `PENDING` o',
          '`ACTIVE` el cambio responde 409: hay que cancelar la subasta primero.',
        ].join('\n'),
      },
      description: { type: 'string', nullable: true, maxLength: 2000 },
    },
  },

  Bid: {
    type: 'object',
    required: ['id', 'amount', 'createdAt', 'bidder'],
    description: 'Una puja registrada. Solo el postor puede ver el historial de sus propias pujas; el de una subasta es público.',
    properties: {
      id: { type: 'string', format: 'uuid' },
      amount: { type: 'number' },
      createdAt: { type: 'string', format: 'date-time' },
      bidder: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, fullName: { type: 'string' } } },
    },
  },

  CreateBidRequest: {
    type: 'object',
    required: ['amount'],
    description: [
      'Pujar en una subasta.',
      '',
      'El monto se compara en centavos enteros, asi que admite como maximo dos',
      'decimales y un envio con mas se rechaza con `400`.',
      '',
      'La puja minima es `startingPrice` si la subasta no tiene pujas, y',
      '`currentBid + minBidIncrement` si ya tiene. El `409` la devuelve en',
      '`details.minimum`, ya redondeada, para que la app pueda pintar el minimo sin',
      'calcularlo y arriesgarse a mostrar un centavo menos.',
    ].join('\n'),
    properties: {
      amount: { type: 'number', example: 120500, description: 'Monto ofertado, en la misma moneda que `startingPrice`.' },
    },
  },

  BidPlacement: {
    type: 'object',
    required: ['bid', 'auction', 'minimumNextBid'],
    description: [
      'Respuesta del alta de pujas. Devuelve la subasta entera ademas de la puja',
      'para que la app actualice contador, ganador y minimo siguiente con una sola',
      'respuesta, sin tener que volver a pedir `GET /auctions/{id}`.',
    ].join('\n'),
    properties: {
      bid: { $ref: '#/components/schemas/Bid' },
      auction: { $ref: '#/components/schemas/Auction' },
      minimumNextBid: { type: 'number', description: 'Puja minima para el siguiente postor.' },
    },
  },

  MyBid: {
    type: 'object',
    required: ['id', 'amount', 'createdAt', 'bidder', 'auction'],
    description: 'Una puja propia con el contexto minimo de la subasta en la que se hizo, para pintar la lista sin un request por fila.',
    properties: {
      id: { type: 'string', format: 'uuid' },
      amount: { type: 'number' },
      createdAt: { type: 'string', format: 'date-time' },
      bidder: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, fullName: { type: 'string' } } },
      auction: {
        type: 'object',
        required: ['id', 'vehicleId', 'status', 'endTime', 'currentBid'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          vehicleId: { type: 'string', format: 'uuid' },
          status: { $ref: '#/components/schemas/AuctionStatus' },
          endTime: { type: 'string', format: 'date-time' },
          currentBid: { type: 'number', nullable: true },
        },
      },
    },
  },

  LifecycleResult: {
    type: 'object',
    required: ['activated', 'closed'],
    description: [
      'Resultado de una corrida del ciclo de vida de subastas.',
      '',
      'El servidor lo corre solo cada 15 segundos; este endpoint solo existe para',
      'dispararlo a mano (tras una caida larga, o para no esperar al tick).',
    ].join('\n'),
    properties: {
      activated: { type: 'integer', description: 'Subastas que pasaron de `PENDING` a `ACTIVE` porque ya habia arrancado.', example: 1 },
      closed: {
        type: 'array',
        description: 'Subastas que se cerraron en esta corrida, con su ganador.',
        items: {
          type: 'object',
          required: ['auctionId', 'vehicleId', 'status', 'winnerId', 'currentBid'],
          properties: {
            auctionId: { type: 'string', format: 'uuid' },
            vehicleId: { type: 'string', format: 'uuid' },
            status: { $ref: '#/components/schemas/AuctionStatus' },
            winnerId: { type: 'string', format: 'uuid', nullable: true, description: 'Null si la subasta termino sin pujas: el vehiculo vuelve al catalogo.' },
            currentBid: { type: 'number', nullable: true },
          },
        },
      },
    },
  },

  Auction: {
    type: 'object',
    required: ['id', 'vehicleId', 'sellerId', 'startingPrice', 'minBidIncrement', 'startTime', 'endTime', 'status', 'bidCount', 'recentBids', 'vehicle'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      vehicleId: { type: 'string', format: 'uuid' },
      sellerId: { type: 'string', format: 'uuid' },
      startingPrice: { type: 'number' },
      currentBid: { type: 'number', nullable: true },
      minBidIncrement: { type: 'number' },
      currentWinner: { nullable: true, allOf: [{ type: 'object', properties: { id: { type: 'string', format: 'uuid' }, fullName: { type: 'string' } } }] },
      startTime: { type: 'string', format: 'date-time' },
      endTime: { type: 'string', format: 'date-time' },
      status: { $ref: '#/components/schemas/AuctionStatus' },
      bidCount: { type: 'integer' },
      recentBids: { type: 'array', items: { $ref: '#/components/schemas/Bid' } },
      vehicle: { $ref: '#/components/schemas/Vehicle' },
      seller: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, fullName: { type: 'string' } } },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  CreateAuctionRequest: {
    type: 'object',
    required: ['vehicleId', 'startingPrice', 'endTime'],
    description: 'Programa una subasta para un vehículo propio que todavía no tiene una. Solo aplica a `saleType` `AUCTION` o `BOTH`.',
    properties: {
      vehicleId: { type: 'string', format: 'uuid' },
      startingPrice: { type: 'number', example: 120000 },
      endTime: { type: 'string', format: 'date-time', description: 'Debe ser futura.' },
      startTime: { type: 'string', format: 'date-time', description: 'Si se omite, la subasta queda `ACTIVE` de inmediato.' },
      minBidIncrement: { type: 'number', example: 10 },
    },
  },

  UpdateAuctionRequest: {
    type: 'object',
    description: 'Solo se puede editar una subasta `PENDING`. Todos los campos opcionales.',
    properties: {
      startingPrice: { type: 'number' },
      endTime: { type: 'string', format: 'date-time' },
      startTime: { type: 'string', format: 'date-time' },
      minBidIncrement: { type: 'number' },
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

  ChatType: {
    type: 'string',
    enum: ['PURCHASE', 'SALE', 'AUCTION_WIN'],
    description: 'Motivo de la conversación. `PURCHASE` es la consulta común sobre un vehículo.',
  },

  MessageType: {
    type: 'string',
    enum: ['TEXT', 'IMAGE', 'OFFER'],
    description: '`OFFER` exige `metadata.amount`; una oferta sin monto no significa nada y se rechaza con `400`.',
  },

  ChatMessage: {
    type: 'object',
    required: ['id', 'chatId', 'senderId', 'senderName', 'content', 'messageType', 'isRead', 'createdAt'],
    description: 'Un mensaje de una conversación.',
    properties: {
      id: { type: 'string', format: 'uuid' },
      chatId: { type: 'string', format: 'uuid' },
      senderId: { type: 'string', format: 'uuid' },
      senderName: { type: 'string' },
      content: { type: 'string', maxLength: 2000 },
      messageType: { $ref: '#/components/schemas/MessageType' },
      metadata: { nullable: true, description: 'Carga útil de `IMAGE` (url) u `OFFER` (monto).' },
      isRead: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  ChatPreview: {
    type: 'object',
    required: ['id', 'chatType', 'counterpart', 'unreadCount', 'createdAt', 'updatedAt'],
    description: [
      'Una conversación tal como aparece en la lista.',
      '',
      '`counterpart` es **siempre el otro** participante: el mismo chat se ve',
      'distinto según quién lo pida, así que el nombre no se puede guardar en la',
      'fila sino que se deriva de quién consulta.',
    ].join('\n'),
    properties: {
      id: { type: 'string', format: 'uuid' },
      chatType: { $ref: '#/components/schemas/ChatType' },
      vehicle: {
        nullable: true,
        allOf: [{
          type: 'object',
          required: ['id', 'title'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string', example: 'Toyota Corolla' },
            imageUrl: { type: 'string', nullable: true },
          },
        }],
      },
      counterpart: {
        type: 'object',
        required: ['id', 'fullName'],
        properties: { id: { type: 'string', format: 'uuid' }, fullName: { type: 'string' } },
      },
      lastMessage: { nullable: true, allOf: [{ $ref: '#/components/schemas/ChatMessage' }] },
      unreadCount: { type: 'integer', description: 'Mensajes del otro sin leer.' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time', description: 'Se toca con cada mensaje: es el orden de la lista.' },
    },
  },

  CreateChatRequest: {
    type: 'object',
    required: ['vehicleId'],
    description: [
      'Abre (o devuelve) la conversación con el vendedor de un vehículo.',
      '',
      'Es idempotente por `vehicleId`: dos toques en "Consultar" devuelven el',
      'mismo chat en vez de abrir conversaciones paralelas. Consultar sobre un',
      'vehículo propio se rechaza con `400`.',
    ].join('\n'),
    properties: {
      vehicleId: { type: 'string', format: 'uuid' },
      chatType: { $ref: '#/components/schemas/ChatType' },
    },
  },

  SendMessageRequest: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', maxLength: 2000 },
      messageType: { $ref: '#/components/schemas/MessageType' },
      metadata: { nullable: true, description: 'Obligatorio con `metadata.amount` numérico si `messageType` es `OFFER`.' },
    },
  },

  ChatUnread: {
    type: 'object',
    required: ['unread'],
    properties: { unread: { type: 'integer' } },
  },

  ChatReadResult: {
    type: 'object',
    required: ['markedAsRead'],
    properties: { markedAsRead: { type: 'integer', description: 'Mensajes del otro que pasaron a leídos.' } },
  },

  DiagnosticSeverity: {
    type: 'string',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    description: '`HIGH` y `CRITICAL` desaconsejan seguir usando el vehículo.',
  },

  DiagnosticMessage: {
    type: 'object',
    required: ['id', 'sender', 'content', 'createdAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      sender: { type: 'string', enum: ['USER', 'AI_ASSISTANT'] },
      content: { type: 'string' },
      model: { type: 'string', nullable: true, description: 'Modelo que generó la respuesta. Permite auditar cada versión.' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  AiDiagnostic: {
    type: 'object',
    required: ['id', 'title', 'resolved', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      vehicleId: { type: 'string', format: 'uuid', nullable: true },
      title: { type: 'string', description: 'La falla declarada por el usuario. No cambia con los seguimientos.' },
      vehicleBrand: { type: 'string', nullable: true },
      vehicleModel: { type: 'string', nullable: true },
      vehicleYear: { type: 'integer', nullable: true },
      mileage: { type: 'integer', nullable: true },
      symptoms: { nullable: true, description: 'Síntomas estructurados que se inyectan como contexto en el prompt.' },
      summary: { type: 'string', nullable: true, description: 'Diagnóstico del modelo. Null mientras la llamada está en curso o si falló.' },
      confidence: { type: 'number', nullable: true, description: 'Confianza normalizada a 0..1.' },
      severity: { nullable: true, allOf: [{ $ref: '#/components/schemas/DiagnosticSeverity' }] },
      resolved: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  AiDiagnosticDetail: {
    allOf: [
      { $ref: '#/components/schemas/AiDiagnostic' },
      {
        type: 'object',
        required: ['messages'],
        properties: { messages: { type: 'array', items: { $ref: '#/components/schemas/DiagnosticMessage' } } },
      },
    ],
  },

  CreateDiagnosticRequest: {
    type: 'object',
    required: ['title'],
    description: [
      'Crea un diagnóstico y pide el primer análisis a Gemini.',
      '',
      'La fila se guarda **antes** de llamar al modelo: si la llamada falla, el',
      'usuario conserva la pregunta y puede reintentar sin volver a escribirla.',
      'Por eso un `summary` null no significa que el diagnóstico se perdió.',
      '',
      'Con `vehicleId`, los datos de la ficha pisan a los campos sueltos.',
    ].join('\n'),
    properties: {
      title: { type: 'string', maxLength: 120, example: 'Hace un ruido metálico al frenar' },
      vehicleId: { type: 'string', format: 'uuid' },
      vehicleBrand: { type: 'string' },
      vehicleModel: { type: 'string' },
      vehicleYear: { type: 'integer' },
      mileage: { type: 'integer' },
      symptoms: { nullable: true, description: 'Objeto libre con los síntomas que se inyectan al prompt.' },
    },
  },

  AskDiagnosticRequest: {
    type: 'object',
    required: ['question'],
    properties: { question: { type: 'string', description: 'Pregunta de seguimiento, con el hilo previo como contexto.' } },
  },

  DiagnosticAnswer: {
    type: 'object',
    required: ['answer'],
    properties: { answer: { type: 'string' } },
  },

  DiagnosticAvailability: {
    type: 'object',
    required: ['available'],
    description: 'Permite que la app esconda la función si el servidor no tiene key, en vez de fallar al tocarla.',
    properties: { available: { type: 'boolean' } },
  },
} as const;
