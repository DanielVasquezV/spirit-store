import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { messageFor } from '@/lib/api/api-error';
import { uploadFile } from '@/lib/api/uploads';
import type { UploadedAssetDto, UploadKind } from '@/lib/types/api';

// Abre la galería y sube lo elegido a Cloudinary vía backend; null si el usuario cancela.
export function useImageUpload(kind: UploadKind) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAndUpload = useCallback(
    async (options: { multiple?: boolean } = {}): Promise<UploadedAssetDto[] | null> => {
      setError(null);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Necesitamos acceso a tus fotos para subir la imagen.');
        return null;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: options.multiple ?? false,
        // El backend corta a 8 MB por archivo: 0.7 deja fotos de cámara muy por debajo sin perder detalle.
        quality: 0.7,
      });
      if (result.canceled) return null;

      setUploading(true);
      try {
        const uploaded: UploadedAssetDto[] = [];
        for (const asset of result.assets) {
          uploaded.push(
            await uploadFile(
              { uri: asset.uri, name: asset.fileName ?? `${kind}-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg' },
              kind,
            ),
          );
        }
        return uploaded;
      } catch (err) {
        setError(messageFor(err, 'No pudimos subir la imagen.'));
        return null;
      } finally {
        setUploading(false);
      }
    },
    [kind],
  );

  return { pickAndUpload, uploading, error };
}
