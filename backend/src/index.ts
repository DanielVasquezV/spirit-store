import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

async function main(): Promise<void> {
  await prisma.$connect();
  console.log('Connected to PostgreSQL');

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`API ready at http://localhost:${env.port}`);
  });

  async function shutdown(signal: string): Promise<void> {
    console.log(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start the API:', err);
  process.exit(1);
});