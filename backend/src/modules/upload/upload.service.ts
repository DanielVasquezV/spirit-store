import {
  cloudinary,
  cloudinaryCredentials,
  isCloudinaryConfigured,
  rootFolder,
  UPLOAD_TRANSFORMATION,
  uploadFolder,
  uploadTransformationString,
} from '../../config/cloudinary.js';
import { AppError } from '../../middleware/error-handler.js';
import type { UploadApiOptions } from 'cloudinary';

/** Archivo tal cual llega del multipart de multer. */
export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export type UploadKind = 'vehicles' | 'dui' | 'chat' | 'misc';

// Guardá el publicId, no la url: es lo único del que se puede derivar el asset
// para borrarlo o transformarlo después.
export interface UploadedAsset {
  url: string;
  publicId: string;
  width: number | null;
  height: number | null;
  bytes: number;
  format: string;
  resourceType: string;
}

interface CloudinaryResult {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  bytes: number;
  format: string;
  resource_type: string;
}

function assertConfigured(): void {
  if (!isCloudinaryConfigured()) {
    // 503 y no 500: la API está sana, lo que falta es una dependencia.
    throw new AppError(
      503,
      'UPLOAD_UNAVAILABLE',
      'El servicio de subida de archivos no está configurado (revise CLOUDINARY_URL)',
    );
  }
}

// El userId va en el nombre para poder depurar las fotos de un vendedor cuando
// hay que borrar una cuenta.
//
// Sin extensión a propósito: si también la lleva, la URL sale
// `...-a3w6d5w0.png.png` y el publicId que persistimos deja de coincidir con lo
// que se ve en el enlace.
function buildAssetId(userId: string, kind: UploadKind): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${uploadFolder(kind)}/${userId}/${Date.now()}-${random}`;
}

// Se espera el resultado de Cloudinary, no solo la aceptación local: si la API
// responde 4xx/5xx hay que propagarlo en vez de devolver una url que no existe.
function runUpload(
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<CloudinaryResult> {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(
          new AppError(502, 'UPLOAD_FAILED', 'Cloudinary rechazó la subida', error.message),
        );
        return;
      }
      resolve(result as unknown as CloudinaryResult);
    });
    // Multer deja el archivo en memoria, no como stream.
    upload.end(buffer);
  });
}

function toAsset(result: CloudinaryResult): UploadedAsset {
  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width ?? null,
    height: result.height ?? null,
    bytes: result.bytes,
    format: result.format,
    resourceType: result.resource_type,
  };
}

// Sube a través del backend. Para perfil, DUI y adjuntos de chat chico; las
// galerías de vehículo conviene subirlas directas con signUpload.
export async function uploadFile(
  file: UploadedFile,
  userId: string,
  kind: UploadKind,
): Promise<UploadedAsset> {
  assertConfigured();

  const result = await runUpload(file.buffer, {
    // El public_id ya trae la carpeta: pasar `folder` aparte la antepondría dos
    // veces.
    public_id: buildAssetId(userId, kind),
    resource_type: 'auto',
    transformation: UPLOAD_TRANSFORMATION,
  });

  return toAsset(result);
}

export interface SignedUploadParams {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  transformation: string;
  /** Unix epoch. Informativo: Cloudinary no lo valida, lo respeta el cliente. */
  expiresAt: number;
}

// Firma para que el móvil suba directo a Cloudinary sin pasar por la API: en
// galerías la foto no vuelve a viajar por el backend. Caduca en 5 minutos y solo
// habilita la carpeta indicada.
export function signUpload(kind: UploadKind): SignedUploadParams {
  assertConfigured();

  const { cloudName, apiKey, apiSecret } = cloudinaryCredentials();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = uploadFolder(kind);

  // La firma tiene que cubrir exactamente lo que el cliente va a mandar, si no
  // Cloudinary la rechaza. La transformación va como string porque así viaja en
  // los parámetros firmados.
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, transformation: uploadTransformationString() },
    apiSecret,
  );

  return {
    timestamp,
    signature,
    apiKey,
    cloudName,
    folder,
    transformation: uploadTransformationString(),
    expiresAt: timestamp + 5 * 60,
  };
}

// Sin esto, cualquier autenticado podría borrar assets de otro proyecto con
// solo saber el nombre. El `..` va aparte porque el public_id de Cloudinary
// acepta rutas relativas. Sin `kind` alcanza con estar dentro de la carpeta raíz.
export async function deleteAsset(publicId: string, kind?: UploadKind): Promise<void> {
  // La entrada se valida antes que la configuración: es una petición mal
  // formada y se rechaza sola, sin depender de que Cloudinary esté disponible.
  if (publicId.includes('..')) {
    throw AppError.badRequest('publicId no válido');
  }

  const expectedPrefix = `${kind ? uploadFolder(kind) : rootFolder()}/`;
  if (!publicId.startsWith(expectedPrefix)) {
    throw AppError.forbidden('El asset no pertenece a esta carpeta de la aplicación');
  }

  assertConfigured();

  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch {
    throw new AppError(502, 'UPLOAD_FAILED', 'No se pudo eliminar el archivo');
  }
}
