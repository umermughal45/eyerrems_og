/**
 * Check if role category migration has been applied
 * This helps provide better error messages if migration is pending
 */

import prisma from '../prisma/client';
import logger from '../utils/logger';

let migrationStatusChecked = false;
let categoryColumnExists = false;

export async function checkCategoryMigrationStatus(): Promise<boolean> {
  if (migrationStatusChecked) {
    return categoryColumnExists;
  }

  try {
    // Try to query the category column
    await prisma.$queryRaw`
      SELECT "category" FROM "Role" LIMIT 1
    `;
    categoryColumnExists = true;
    migrationStatusChecked = true;
    logger.info('Role category column exists - migration applied');
    return true;
  } catch (error: any) {
    // Column doesn't exist or other error
    if (error.message?.includes('column') && error.message?.includes('does not exist')) {
      categoryColumnExists = false;
      migrationStatusChecked = true;
      logger.warn('Role category column does not exist - migration may be pending. Run: psql -d your_database < backend/prisma/migrations/MANUAL_ADD_ROLE_CATEGORY.sql');
      return false;
    }
    // Other error - assume it exists to avoid blocking
    categoryColumnExists = true;
    migrationStatusChecked = true;
    return true;
  }
}
