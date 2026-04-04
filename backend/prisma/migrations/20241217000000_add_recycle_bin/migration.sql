-- CreateTable: Recycle Bin for soft-deleted records
-- Records are kept for 30 days before permanent deletion

CREATE TABLE "DeletedRecord" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityData" JSONB NOT NULL,
    "deletedBy" TEXT,
    "deletedByName" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeletedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletedRecord_entityType_idx" ON "DeletedRecord"("entityType");

-- CreateIndex
CREATE INDEX "DeletedRecord_entityId_idx" ON "DeletedRecord"("entityId");

-- CreateIndex
CREATE INDEX "DeletedRecord_deletedAt_idx" ON "DeletedRecord"("deletedAt");

-- CreateIndex
CREATE INDEX "DeletedRecord_expiresAt_idx" ON "DeletedRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "DeletedRecord_deletedBy_idx" ON "DeletedRecord"("deletedBy");

