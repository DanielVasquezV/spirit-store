import { Router } from 'express';

import { loadUser, requireAuth, requireRole } from '../../middleware/auth.js';
import * as auctionController from './auction.controller.js';
import * as bidController from '../bid/bid.controller.js';

const router = Router();

// Consultar subastas es publico, igual que el catalogo. Programarlas, editarlas,
// cancelarlas y pujar exige sesion; las tres primeras tambien que el vendedor
// sea el dueno del vehiculo.
router.get('/', auctionController.list);
router.post('/', requireAuth, loadUser, auctionController.create);

// Antes que '/:id': `lifecycle` no es un UUID y requireUuid lo rechazaria con un
// 400 de validacion en lugar de ejecutar la operacion.
//
// ADMIN: dispara el cierre de subastas vencidas de todo el sistema, asi que no
// puede ser un endpoint de usuario aunque no modifique datos del solicitante.
// Antes que '/:id': 'mine' no es un UUID.
router.get('/mine', requireAuth, loadUser, auctionController.listMine);
router.post('/lifecycle', requireAuth, loadUser, requireRole('ADMIN'), auctionController.runLifecycle);

router.get('/:id', auctionController.getOne);
router.patch('/:id', requireAuth, loadUser, auctionController.update);
router.delete('/:id', requireAuth, loadUser, auctionController.remove);

// Pujas. El historial es publico; la puja requiere sesion y que el postor no sea
// el vendedor (eso lo resuelve el servicio, que es quien tiene el bloqueo de fila).
router.get('/:id/bids', bidController.listForAuction);
router.post('/:id/bids', requireAuth, loadUser, bidController.place);

export default router;