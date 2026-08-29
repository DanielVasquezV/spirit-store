import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import userRoutes from './modules/user/user.routes.js';

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientUrl === '*' ? true : env.clientUrl.split(',') }));
  app.use(express.json());
  app.use(morgan('dev'));

  app.get('/', (_req, res) => {
    res.json({
      name: 'spirit-store API',
      version: '0.1.0',
      message: 'All systems operational.',
      endpoints: ['/api/health', '/api/users'],
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/users', userRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}