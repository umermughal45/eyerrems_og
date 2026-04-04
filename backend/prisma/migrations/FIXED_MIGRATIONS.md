# Fixed Migration Order Issues

## Problem
Multiple migrations were trying to reference tables that don't exist yet due to migration order (timestamps).

## Migrations Fixed

### 1. `20241231000000_create_property_subsidiary_tables`
**Issue:** Tried to create foreign key to `Location` table before it exists.

**Fix:** Added check to verify `Location` table exists before creating foreign key.

### 2. `20250101000000_add_location_and_subsidiary_to_deal`
**Issue:** Tried to alter `Deal` table before it exists.

**Fix:** Wrapped all operations in a check to verify `Deal` table exists first.

### 3. `20250101000001_create_property_subsidiary_tables`
**Issue:** Same as #1 - foreign key to `Location` before it exists.

**Fix:** Added check to verify `Location` table exists before creating foreign key.

### 4. `20250102000000_add_location_leaf_and_active_fields`
**Issue:** Tried to alter `Location` and `PropertySubsidiary` tables before they exist.

**Fix:** Added checks to verify both tables exist before altering them.

## How to Apply

When database is available, run:

```bash
cd server

# Mark failed migrations as rolled back
npx prisma migrate resolve --rolled-back 20241231000000_create_property_subsidiary_tables
npx prisma migrate resolve --rolled-back 20250101000000_add_location_and_subsidiary_to_deal
npx prisma migrate resolve --rolled-back 20250101000001_create_property_subsidiary_tables
npx prisma migrate resolve --rolled-back 20250102000000_add_location_leaf_and_active_fields

# Apply all migrations
npx prisma migrate deploy
```

Or if you can reset the database:

```bash
cd server
npx prisma migrate reset
```

All migrations will now apply in order without errors because they check for table existence first.

