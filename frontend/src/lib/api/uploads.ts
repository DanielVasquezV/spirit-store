import { File } from 'expo-file-system';
import { http } from './http-client';
import type { UploadedAssetDto, UploadKind } from '@/lib/types/api';

export interface LocalFile {
  uri: string;
  name: string;
  mimeType: string;
}

// El fetch global de Expo (expo/fetch) no acepta { uri, name, type }: en nativo el archivo va como File de expo-file-system, en web como Blob.
async function appendFile(form: FormData, file: LocalFile): Promise<void> {
  if (file.uri.startsWith('blob:') || file.uri.startsWith('data:')) {
    const blob = await (await fetch(file.uri)).blob();
    form.append('file', blob, file.name);
    return;
  }
  form.append('file', new File(file.uri) as unknown as Blob, file.name);
}

// Subida proxy a Cloudinary vía backend: devuelve la URL ya alojada.
export async function uploadFile(file: LocalFile, kind: UploadKind): Promise<UploadedAssetDto> {
  const form = new FormData();
  form.append('kind', kind);
  await appendFile(form, file);
  return http.upload<UploadedAssetDto>('/uploads', form);
}
