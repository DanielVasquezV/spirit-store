#!/bin/sh
set -e

echo "Applying Prisma migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Starting API..."
exec node dist/index.js