#!/bin/bash

echo "Running migrations..."
npm install
npx prisma migrate deploy

echo "Generating Prisma client..."
npx prisma generate

echo "Running seeds..."
npx ts-node prisma/seeds/chart-of-accounts-expanded.ts
npx ts-node prisma/seeds/chart-of-accounts-comprehensive.ts
npm run prisma:seed
npm run build

echo "Build & DB setup completed!"
