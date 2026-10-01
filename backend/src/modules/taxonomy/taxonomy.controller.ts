import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/error-handler.js';
import { ok } from '../../lib/api-response.js';
import { buildTaxonomies } from '../../services/taxonomy.js';

export const getTaxonomies = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, buildTaxonomies());
});