import { Router } from 'express';

import { loadUser, requireAuth } from '../../middleware/auth.js';
import * as bidController from './bid.controller.js';

const router = Router();

// Montado en `/bids`. El alta y el historial de pujas viven en el router de
// subastas (`/auctions/:id/bids`) porque son sub-recursos de una subasta; aca solo
// queda la consulta propia del usuario.
//
// El id del postor sale del token, nunca de un parametro: pedir las pujas de
// otro exigiria que el endpoint aceptara un bidderId, y eso seria una fuga.
router.get('/mine', requireAuth, loadUser, bidController.listMine);

export default router;