/*
  Warnings:

  - A unique constraint covering the columns `[trackingId]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "trackingId" TEXT;

-- CreateTable
CREATE TABLE "EntityAccountBinding" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "EntityAccountBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityMetadata" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "notes" TEXT,
    "references" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityAccountBinding_entityType_entityId_idx" ON "EntityAccountBinding"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "EntityAccountBinding_accountId_idx" ON "EntityAccountBinding"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityAccountBinding_entityType_entityId_accountId_key" ON "EntityAccountBinding"("entityType", "entityId", "accountId");

-- CreateIndex
CREATE INDEX "EntityMetadata_entityType_entityId_idx" ON "EntityMetadata"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityMetadata_entityType_entityId_key" ON "EntityMetadata"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_trackingId_key" ON "Employee"("trackingId");

-- AddForeignKey
ALTER TABLE "EntityAccountBinding" ADD CONSTRAINT "EntityAccountBinding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
