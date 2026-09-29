import { Router } from 'express';

import { loadUser, requireAuth } from '../../middleware/auth.js';
import * as vehicleController from './vehicle.controller.js';

const router = Router();

// El catalogo es publico a proposito: la app puede listar y ver fichas antes de
// pedir sesion. Publicar, editar y borrar si exigen cuenta.
router.get('/', vehicleController.list);
router.get('/mine', requireAuth, loadUser, vehicleController.listMine);
router.post('/', requireAuth, loadUser, vehicleController.create);

router.get('/:id', vehicleController.getOne);
router.patch('/:id', requireAuth, loadUser, vehicleController.update);
router.delete('/:id', requireAuth, loadUser, vehicleController.remove);

// Galeria. Las fotos se suben antes con /uploads/sign y aca solo se asocian al
// vehiculo por url + publicId.
router.post('/:id/images', requireAuth, loadUser, vehicleController.addImage);
router.delete('/:id/images/:imageId', requireAuth, loadUser, vehicleController.removeImage);

export default router;
