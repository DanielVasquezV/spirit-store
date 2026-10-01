import { Router } from 'express';

import { loadUser, requireAuth } from '../../middleware/auth.js';
import * as chatController from './chat.controller.js';

const router = Router();

// Montado en `/chats`. Todo exige sesion: un chat sin autenticar no tiene
// contraparte, asi que no hay version anonima util.
//
// El id de participante siempre sale del token, nunca de la URL ni del body:
// `/chats/:id` es del usuario que lo pide, y `assertParticipant` impide leer el
// hilo de otro aun con un id valido.
router.use(requireAuth, loadUser);

router.get('/', chatController.list);
router.post('/', chatController.create);

router.get('/unread', chatController.unread);

router.get('/:id/messages', chatController.messages);
router.post('/:id/messages', chatController.send);
router.patch('/:id/read', chatController.markRead);

export default router;