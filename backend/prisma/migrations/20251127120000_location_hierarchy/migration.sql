-- Create Location hierarchy table
CREATE TABLE "Location" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

ALTER TABLE "Location"
  ADD CONSTRAINT "Location_parentId_fkey"
  FOREIGN KEY ("parentId")
  REFERENCES "Location" ("id") ON DELETE CASCADE;

CREATE INDEX "Location_parentId_index" ON "Location" ("parentId");
CREATE INDEX "Location_type_index" ON "Location" ("type");
ALTER TABLE "Location" ADD CONSTRAINT "Location_type_name_parentId_key" UNIQUE ("type", "name", "parentId");

-- Extend Property table to reference Location nodes
ALTER TABLE "Property"
  ADD COLUMN "locationId" TEXT;

ALTER TABLE "Property"
  ADD CONSTRAINT "Property_locationId_fkey"
  FOREIGN KEY ("locationId")
  REFERENCES "Location" ("id") ON DELETE SET NULL;

CREATE INDEX "Property_locationId_index" ON "Property" ("locationId");
