import { DataMigrationDefinition } from '../data-migration.interface';

/**
 * Backfill emailFromName to "Wikso" for settings where emailFromAddress
 * is set but emailFromName was left empty.
 */
export const backfillEmailFromName: DataMigrationDefinition = {
  name: '20260310_backfill_email_from_name',
  description: 'Set emailFromName to "Wikso" where it was empty but email address was configured',

  async up(prisma) {
    await prisma.systemSettings.updateMany({
      where: {
        emailFromName: '',
        emailFromAddress: { not: '' },
      },
      data: {
        emailFromName: 'Wikso',
      },
    });
  },
};
