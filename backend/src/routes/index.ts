import { Router } from 'express';

import authRoutes from '../modules/auth/auth.routes.js';
import auctionRoutes from '../modules/auction/auction.routes.js';
import uploadRoutes from '../modules/upload/upload.routes.js';
import userRoutes from '../modules/user/user.routes.js';
import vehicleRoutes from '../modules/vehicle/vehicle.routes.js';

// Agregador de la API. Agregar un dominio (vehicles, auctions, chat) es una
// línea en esta función.
export function apiRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        service: 'spiritapex-api',
        status: 'ok',
        uptime: process.uptime(),
      },
    });
  });

  router.use('/auth', authRoutes);
  router.use('/uploads', uploadRoutes);
  router.use('/users', userRoutes);
  router.use('/vehicles', vehicleRoutes);
  router.use('/auctions', auctionRoutes);

  return router;
}
