-- Create categories for reusable dropdown values
CREATE TABLE "DropdownCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DropdownCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DropdownCategory_key_key" ON "DropdownCategory"("key");
CREATE INDEX "DropdownCategory_isActive_idx" ON "DropdownCategory"("isActive");

-- Create reusable option table
CREATE TABLE "DropdownOption" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DropdownOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DropdownOption_categoryId_value_key" ON "DropdownOption"("categoryId","value");
CREATE INDEX "DropdownOption_categoryId_idx" ON "DropdownOption"("categoryId");
CREATE INDEX "DropdownOption_isActive_idx" ON "DropdownOption"("isActive");

ALTER TABLE "DropdownOption"
    ADD CONSTRAINT "DropdownOption_categoryId_fkey"
    FOREIGN KEY ("categoryId")
    REFERENCES "DropdownCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create amenities master list
CREATE TABLE "Amenity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Amenity_name_key" ON "Amenity"("name");
CREATE INDEX "Amenity_isActive_idx" ON "Amenity"("isActive");

-- Seed dropdown categories
INSERT INTO "DropdownCategory" ("id","key","name","description","metadata")
VALUES
    (gen_random_uuid()::text, 'property.status', 'Property Status', 'Statuses used in property forms', '{"context":"property"}'),
    (gen_random_uuid()::text, 'deal.stage', 'Deal Stage', 'Pipeline stages tracked for deals', '{"context":"deal"}'),
    (gen_random_uuid()::text, 'deal.status', 'Deal Status', 'High level deal state', '{"context":"deal"}'),
    (gen_random_uuid()::text, 'payment.status', 'Payment Status', 'Statuses available on payment flows', '{"context":"finance"}');

-- Populate property status options
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Vacant', 'Vacant', 1 FROM "DropdownCategory" WHERE "key" = 'property.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Occupied', 'Occupied', 2 FROM "DropdownCategory" WHERE "key" = 'property.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Active', 'Active', 3 FROM "DropdownCategory" WHERE "key" = 'property.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Maintenance', 'Maintenance', 4 FROM "DropdownCategory" WHERE "key" = 'property.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'For Sale', 'For Sale', 5 FROM "DropdownCategory" WHERE "key" = 'property.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'For Rent', 'For Rent', 6 FROM "DropdownCategory" WHERE "key" = 'property.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Sold', 'Sold', 7 FROM "DropdownCategory" WHERE "key" = 'property.status';

-- Populate deal stages
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Prospecting', 'prospecting', 1 FROM "DropdownCategory" WHERE "key" = 'deal.stage';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Qualified', 'qualified', 2 FROM "DropdownCategory" WHERE "key" = 'deal.stage';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Proposal', 'proposal', 3 FROM "DropdownCategory" WHERE "key" = 'deal.stage';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Negotiation', 'negotiation', 4 FROM "DropdownCategory" WHERE "key" = 'deal.stage';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Closing', 'closing', 5 FROM "DropdownCategory" WHERE "key" = 'deal.stage';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Closed Won', 'closed-won', 6 FROM "DropdownCategory" WHERE "key" = 'deal.stage';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Closed Lost', 'closed-lost', 7 FROM "DropdownCategory" WHERE "key" = 'deal.stage';

-- Populate deal statuses
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Open', 'open', 1 FROM "DropdownCategory" WHERE "key" = 'deal.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'In Progress', 'in_progress', 2 FROM "DropdownCategory" WHERE "key" = 'deal.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Won', 'won', 3 FROM "DropdownCategory" WHERE "key" = 'deal.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Lost', 'lost', 4 FROM "DropdownCategory" WHERE "key" = 'deal.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Cancelled', 'cancelled', 5 FROM "DropdownCategory" WHERE "key" = 'deal.status';

-- Populate payment statuses
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Completed', 'completed', 1 FROM "DropdownCategory" WHERE "key" = 'payment.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Pending', 'pending', 2 FROM "DropdownCategory" WHERE "key" = 'payment.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Failed', 'failed', 3 FROM "DropdownCategory" WHERE "key" = 'payment.status';
INSERT INTO "DropdownOption" ("id","categoryId","label","value","sortOrder")
SELECT gen_random_uuid()::text, id, 'Reversed', 'reversed', 4 FROM "DropdownCategory" WHERE "key" = 'payment.status';

-- Seed amenities
INSERT INTO "Amenity" ("id","name","description")
VALUES
    (gen_random_uuid()::text, 'Parking', 'Reserved parking bays for residents'),
    (gen_random_uuid()::text, 'Security', '24/7 CCTV and guards'),
    (gen_random_uuid()::text, 'Elevator', 'Lift access for all floors'),
    (gen_random_uuid()::text, 'Water Supply', 'Uninterrupted water availability'),
    (gen_random_uuid()::text, 'Gas', 'Piped gas connection'),
    (gen_random_uuid()::text, 'Electric Backup', 'Generator backup for power outages'),
    (gen_random_uuid()::text, 'Gym', 'On-site gym facility'),
    (gen_random_uuid()::text, 'Swimming Pool', 'Temperature-controlled swimming pool'),
    (gen_random_uuid()::text, 'Play Area', 'Children play zone');

