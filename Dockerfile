FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma

RUN npm install

COPY backend .

# ⚠️ Set dummy DATABASE_URL just for build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npm run build

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]