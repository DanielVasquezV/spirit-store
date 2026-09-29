import { Router } from 'express';

import { loadUser, requireAuth } from '../../middleware/auth.js';
import * as auctionController from './auction.controller.js';

const router = Router();

// Consultar subastas es publico, igual que el catalogo. Programarlas, editarlas
// y cancelarlas exige sesion y que el vendedor sea el dueño del vehiculo.
//
// No hay endpoint para pujar: el alta de pujas y su push en vivo son el
// servicio de subastas por socket, todavia pendiente.
router.get('/', auctionController.list);
router.post('/', requireAuth, loadUser, auctionController.create);

router.get('/:id', auctionController.getOne);
router.patch('/:id', requireAuth, loadUser, auctionController.update);
router.delete('/:id', requireAuth, loadUser, auctionController.remove);

export default router;
