import { Router } from 'express';

import { loadUser, requireAuth } from '../../middleware/auth.js';
import * as orderController from './order.controller.js';

const router = Router();

router.get('/', requireAuth, loadUser, orderController.listMine);
router.post('/', requireAuth, loadUser, orderController.create);

router.get('/:id', requireAuth, loadUser, orderController.getOne);
router.post('/:id/cancel', requireAuth, loadUser, orderController.cancel);
router.post('/:id/checkout-session', requireAuth, loadUser, orderController.createCheckoutSession);
router.post('/:id/confirm', requireAuth, loadUser, orderController.confirm);

export default router;