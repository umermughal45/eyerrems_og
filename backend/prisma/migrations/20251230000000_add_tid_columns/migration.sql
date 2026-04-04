-- AlterTable: Add tid column to Property
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'tid') THEN
        ALTER TABLE "Property" ADD COLUMN "tid" TEXT;
    END IF;
END $$;

-- AlterTable: Add tid column to Client
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Client' AND column_name = 'tid') THEN
        ALTER TABLE "Client" ADD COLUMN "tid" TEXT;
    END IF;
END $$;

-- AlterTable: Add tid column to Deal
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Deal' AND column_name = 'tid') THEN
        ALTER TABLE "Deal" ADD COLUMN "tid" TEXT;
    END IF;
END $$;

-- CreateIndex: Add unique index on Property.tid (partial index to allow multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS "Property_tid_key" ON "Property"("tid") WHERE "tid" IS NOT NULL;

-- CreateIndex: Add unique index on Client.tid (partial index to allow multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS "Client_tid_key" ON "Client"("tid") WHERE "tid" IS NOT NULL;

-- CreateIndex: Add unique index on Deal.tid (partial index to allow multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS "Deal_tid_key" ON "Deal"("tid") WHERE "tid" IS NOT NULL;

-- CreateIndex: Add regular index on Property.tid for faster searches
CREATE INDEX IF NOT EXISTS "Property_tid_idx" ON "Property"("tid");

-- CreateIndex: Add regular index on Client.tid for faster searches
CREATE INDEX IF NOT EXISTS "Client_tid_idx" ON "Client"("tid");

-- CreateIndex: Add regular index on Deal.tid for faster searches
CREATE INDEX IF NOT EXISTS "Deal_tid_idx" ON "Deal"("tid");

