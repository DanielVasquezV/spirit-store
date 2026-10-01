import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { uploadSingle } from '../../middleware/upload.js';
import * as uploadController from './upload.controller.js';

const router = Router();

// Todas exigen sesión: sin token, la API sería un proxy gratis para alojar
// contenido en el bucket de Supabase del proyecto. uploadSingle va después de
// requireAuth para que un anónimo no gaste memoria leyendo el archivo antes de
// ser rechazado.
router.post('/', requireAuth, uploadSingle, uploadController.uploadOne);
router.delete('/', requireAuth, uploadController.remove);

export default router;
