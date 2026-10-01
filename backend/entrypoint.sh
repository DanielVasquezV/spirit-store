#!/bin/sh
set -e

echo "Applying Prisma migrations..."
prisma migrate deploy

echo "Starting API..."
exec node dist/index.js
