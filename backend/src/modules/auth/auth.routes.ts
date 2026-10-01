import { Router } from 'express';

import { loadUser, requireAuth } from '../../middleware/auth.js';
import * as authController from './auth.controller.js';

const router = Router();

// Register y login son las únicas públicas. El orden requireAuth -> loadUser
// importa: loadUser lee req.auth y refresca el usuario desde la base, porque el
// token puede tener horas y el rol haber cambiado.
router.post('/register', authController.register);
router.post('/login', authController.login);

router.get('/me', requireAuth, loadUser, authController.me);
router.patch('/me', requireAuth, loadUser, authController.updateMe);

export default router;
