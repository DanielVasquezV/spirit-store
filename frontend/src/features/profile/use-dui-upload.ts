import { useState } from 'react';
import { useSession } from '@/features/auth/session-provider';
import { messageFor } from '@/lib/api/api-error';
import { useImageUpload } from './use-image-upload';

// Elegir la foto del DUI, subirla y guardarla en el perfil; cargarla la deja verificada en el backend.
export function useDuiUpload() {
  const { user, updateProfile } = useSession();
  const upload = useImageUpload('dui');
  const [saveError, setSaveError] = useState<string | null>(null);

  const pickAndSave = async (): Promise<void> => {
    setSaveError(null);
    const uploaded = await upload.pickAndUpload();
    if (!uploaded?.[0]) return;
    try {
      await updateProfile({ duiPhotoUrl: uploaded[0].url });
    } catch (err) {
      setSaveError(messageFor(err, 'No pudimos guardar tu documento.'));
    }
  };

  return {
    status: user?.duiStatus ?? 'NONE',
    loaded: Boolean(user && user.duiStatus !== 'NONE'),
    pickAndSave,
    uploading: upload.uploading,
    error: upload.error ?? saveError,
  };
}
