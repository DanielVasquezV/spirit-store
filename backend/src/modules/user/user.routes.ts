import { Router } from 'express';

import * as userController from './user.controller.js';

const router = Router();

router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.get('/:id', userController.getUserById);

export default router;