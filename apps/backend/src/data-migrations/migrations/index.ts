import { DataMigrationDefinition } from '../data-migration.interface';
import { backfillEmailFromName } from './20260310-backfill-email-from-name';

/**
 * Central registry of all data migrations.
 *
 * Rules:
 * 1. Always append new migrations to the END of this array
 * 2. Never remove or reorder existing entries
 * 3. Migration names must be unique and immutable
 */
export const ALL_DATA_MIGRATIONS: DataMigrationDefinition[] = [
  backfillEmailFromName,
];
