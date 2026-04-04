import { PrismaClient } from "@prisma/client"

const globalForPrisma = global as unknown as { prisma: PrismaClient }

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  const client = new PrismaClient()
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client
  }
  return client
}

export const prisma = getPrismaClient()
