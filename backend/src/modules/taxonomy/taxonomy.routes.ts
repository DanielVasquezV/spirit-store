import { Router } from 'express';

import * as taxonomyController from './taxonomy.controller.js';

const router = Router();

// Taxonomías de enums para pintar selects/labels en el front sin hardcodear.
// Es lectura pública porque no expone datos sensibles.
router.get('/taxonomies', taxonomyController.getTaxonomies);

export default router;