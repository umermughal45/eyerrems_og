/**
 * Cleanup Recycle Bin Script
 * 
 * DISABLED: Auto-cleanup is disabled. Records are kept indefinitely until manually removed.
 * 
 * This script is kept for backward compatibility but does nothing.
 * Records can only be deleted manually through the UI.
 * 
 * NOTE: If you have a scheduled task running this script, you should disable it.
 * - Windows Task Scheduler: Disable the scheduled task
 * - Linux cron: Remove the cron job entry
 * - Railway/Heroku: Disable the scheduled job
 */

import { cleanupExpiredRecords } from '../src/services/soft-delete-service';
import logger from '../src/utils/logger';

async function main() {
  logger.info('Recycle bin cleanup script called, but auto-cleanup is disabled.');
  logger.info('Records are kept indefinitely until manually removed.');
  
  try {
    const deletedCount = await cleanupExpiredRecords();
    logger.info(`Cleanup completed. ${deletedCount} records deleted (auto-cleanup is disabled).`);
    process.exit(0);
  } catch (error) {
    logger.error('Cleanup failed:', error);
    process.exit(1);
  }
}

main();

