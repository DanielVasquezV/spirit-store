import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

config({ path: '../.env' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: 'admin@spirit.dev' },
    update: {},
    create: {
      email: 'admin@spirit.dev',
      name: 'Admin',
      password: 'change-me',
      role: 'ADMIN',
    },
  });

  console.log(`Seed complete: user ${user.email} is ready.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });