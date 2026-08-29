import { projectRoot } from '../lib/env-loader.js';
import { resolve } from 'node:path';

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  clientUrl: process.env.CLIENT_URL ?? '*',
};

if (!env.databaseUrl) {
  throw new Error(
    `DATABASE_URL is missing. Create ${resolve(projectRoot, '.env')} from .env.example at the monorepo root.`,
  );
}