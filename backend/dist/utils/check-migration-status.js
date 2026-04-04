"use strict";
/**
 * Check if role category migration has been applied
 * This helps provide better error messages if migration is pending
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCategoryMigrationStatus = checkCategoryMigrationStatus;
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
let migrationStatusChecked = false;
let categoryColumnExists = false;
async function checkCategoryMigrationStatus() {
    if (migrationStatusChecked) {
        return categoryColumnExists;
    }
    try {
        // Try to query the category column
        await client_1.default.$queryRaw `
      SELECT "category" FROM "Role" LIMIT 1
    `;
        categoryColumnExists = true;
        migrationStatusChecked = true;
        logger_1.default.info('Role category column exists - migration applied');
        return true;
    }
    catch (error) {
        // Column doesn't exist or other error
        if (error.message?.includes('column') && error.message?.includes('does not exist')) {
            categoryColumnExists = false;
            migrationStatusChecked = true;
            logger_1.default.warn('Role category column does not exist - migration may be pending. Run: psql -d your_database < backend/prisma/migrations/MANUAL_ADD_ROLE_CATEGORY.sql');
            return false;
        }
        // Other error - assume it exists to avoid blocking
        categoryColumnExists = true;
        migrationStatusChecked = true;
        return true;
    }
}
//# sourceMappingURL=check-migration-status.js.map