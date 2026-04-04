/*
  Warnings:

  - Note: tid indexes are created conditionally - only if columns exist
  - The tid columns are added in migration 20251230000000_add_tid_columns

*/
-- CreateIndex: Create tid indexes only if columns exist (using partial index to allow NULLs)
DO $$ 
BEGIN
    -- Only create indexes if the tid columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Client' AND column_name = 'tid') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "Client_tid_key" ON "Client"("tid") WHERE "tid" IS NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Deal' AND column_name = 'tid') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "Deal_tid_key" ON "Deal"("tid") WHERE "tid" IS NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'tid') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "Property_tid_key" ON "Property"("tid") WHERE "tid" IS NOT NULL;
    END IF;
END $$;
