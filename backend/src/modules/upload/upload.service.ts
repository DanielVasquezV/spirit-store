import {
  ALLOWED_MIME_TYPES,
  bucketName,
  isStorageConfigured,
  publicUrl,
  rootFolder,
  storageClient,
  uploadFolder,
  type UploadKind,
} from '../../config/storage.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error-handler.js';

export type { UploadKind };

// Archivo tal cual llega del multipart de multer.
export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

// Se guarda el publicId (la ruta del objeto en el bucket): es lo único con lo que se puede borrar después.
export interface UploadedAsset {
  url: string;
  publicId: string;
  width: number | null;
  height: number | null;
  bytes: number;
  format: string;
  resourceType: string;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

function assertConfigured(): void {
  if (!isStorageConfigured()) {
    // 503 y no 500: la API está sana, lo que falta es una dependencia.
    throw new AppError(
      503,
      'UPLOAD_UNAVAILABLE',
      'El servicio de subida de archivos no está configurado (revise SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)',
    );
  }
}

let bucketReady: Promise<void> | null = null;

// El bucket se crea público la primera vez: así no hay que configurarlo a mano en el panel de Supabase.
function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const storage = storageClient().storage;
    const { data } = await storage.getBucket(bucketName());
    if (data) return;
    const { error } = await storage.createBucket(bucketName(), {
      public: true,
      fileSizeLimit: env.storage.maxFileSizeBytes,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
    });
    // Otra instancia pudo crearlo entre la lectura y el alta: eso no es un error.
    if (error && !/already exists/i.test(error.message)) throw error;
  })().catch((err: unknown) => {
    bucketReady = null;
    throw new AppError(502, 'UPLOAD_FAILED', 'No se pudo preparar el bucket de Supabase', (err as Error).message);
  });
  return bucketReady;
}

// El userId va en la ruta para poder depurar los archivos de una cuenta cuando hay que borrarla.
function buildObjectPath(userId: string, kind: UploadKind, mimetype: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${uploadFolder(kind)}/${userId}/${Date.now()}-${random}.${EXTENSIONS[mimetype] ?? 'bin'}`;
}

// Sube a Supabase Storage a través del backend y devuelve la URL pública del bucket.
export async function uploadFile(file: UploadedFile, userId: string, kind: UploadKind): Promise<UploadedAsset> {
  assertConfigured();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', `Tipo de archivo no permitido: ${file.mimetype}`);
  }
  await ensureBucket();

  const path = buildObjectPath(userId, kind, file.mimetype);
  const { error } = await storageClient()
    .storage.from(bucketName())
    .upload(path, file.buffer, { contentType: file.mimetype, cacheControl: '31536000', upsert: false });
  if (error) {
    throw new AppError(502, 'UPLOAD_FAILED', 'Supabase Storage rechazó la subida', error.message);
  }

  return {
    url: publicUrl(path),
    publicId: path,
    // Supabase no procesa la imagen: las dimensiones no se conocen sin decodificarla.
    width: null,
    height: null,
    bytes: file.size,
    format: EXTENSIONS[file.mimetype] ?? 'bin',
    resourceType: file.mimetype.startsWith('image/') ? 'image' : 'raw',
  };
}

// Sin el chequeo de prefijo, cualquier autenticado podría borrar otros objetos del bucket con solo saber la ruta.
export async function deleteAsset(publicId: string, kind?: UploadKind): Promise<void> {
  if (publicId.includes('..')) {
    throw AppError.badRequest('publicId no válido');
  }

  const expectedPrefix = `${kind ? uploadFolder(kind) : rootFolder()}/`;
  if (!publicId.startsWith(expectedPrefix)) {
    throw AppError.forbidden('El asset no pertenece a esta carpeta de la aplicación');
  }

  assertConfigured();

  // remove no falla si el objeto ya no existe: el borrado es idempotente para los reintentos de la app.
  const { error } = await storageClient().storage.from(bucketName()).remove([publicId]);
  if (error) {
    throw new AppError(502, 'UPLOAD_FAILED', 'No se pudo eliminar el archivo');
  }
}
