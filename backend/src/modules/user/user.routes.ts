import { Router } from 'express';

import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as userController from './user.controller.js';

const router = Router();

// El alta pública vive en POST /api/auth/register, que fija el rol en el
// service. Abrirla acá permitiría autoasignarse ADMIN en el body. El listado
// también se restringe: la vista pública no expone teléfono ni DUI, pero el
// conjunto completo sigue siendo dato personal.
router.get('/', requireAuth, requireRole('ADMIN'), userController.getUsers);
router.post('/', requireAuth, requireRole('ADMIN'), userController.createUser);

router.get('/:id', requireAuth, userController.getUserById);

export default router;
