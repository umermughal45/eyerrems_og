# Fix Migration Order Issue

## Problem
Migration `20241231000000_create_property_subsidiary_tables` tries to create a foreign key to `Location` table before `Location` table exists (created in `20251127120000_location_hierarchy`).

## Solution Applied
Updated the migration to check if `Location` table exists before creating the foreign key.

## Steps to Resolve

### Option 1: Mark Migration as Rolled Back and Reapply (Recommended)

```bash
cd server

# Mark the failed migration as rolled back
npx prisma migrate resolve --rolled-back 20241231000000_create_property_subsidiary_tables

# Apply migrations again
npx prisma migrate deploy
```

### Option 2: If Database is Fresh/Can be Reset

```bash
cd server

# Reset database (WARNING: This deletes all data)
npx prisma migrate reset

# This will now work because the migration checks for Location table existence
```

### Option 3: Manual Fix (If migration partially applied)

```sql
-- Check if PropertySubsidiary table exists but foreign key is missing
-- If Location table exists, add the foreign key manually:

ALTER TABLE "PropertySubsidiary" 
ADD CONSTRAINT "PropertySubsidiary_locationId_fkey" 
FOREIGN KEY ("locationId") 
REFERENCES "Location"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Then mark migration as applied
```

Then run:
```bash
cd server
npx prisma migrate resolve --applied 20241231000000_create_property_subsidiary_tables
npx prisma migrate deploy
```

## Verification

After fixing, verify with:
```bash
npx prisma migrate status
```

Should show: "Database schema is up to date!"

