import { Router } from 'express';

import { loadUser, requireAuth } from '../../middleware/auth.js';
import * as diagnosticController from './diagnostic.controller.js';

const router = Router();

// Montado en `/diagnostics`.
//
// Todo exige sesion: un diagnostico pertenece a su autor y se filtra por `userId`
// en cada query, asi que un id ajeno devuelve 404 y no 403 (no se le confirma
// ni que existe).
router.use(requireAuth, loadUser);

router.get('/availability', diagnosticController.availability);

router.get('/', diagnosticController.list);
router.post('/', diagnosticController.create);

router.get('/:id', diagnosticController.detail);
router.patch('/:id/resolved', diagnosticController.resolve);
router.post('/:id/ask', diagnosticController.ask);

export default router;