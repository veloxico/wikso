import { PrismaClient } from '@prisma/client';

export interface DataMigrationDefinition {
  /**
   * Unique name, conventionally prefixed with YYYYMMDD timestamp.
   * Example: "20260310_backfill_email_from_name"
   * MUST be immutable once shipped — never rename or remove.
   */
  name: string;

  /** Human-readable description for logs. */
  description: string;

  /**
   * The migration function. Receives a Prisma transaction client.
   * Must be idempotent: running it twice on the same data produces the same result.
   * Use WHERE clauses, upserts, or existence checks.
   */
  up(prisma: PrismaClient): Promise<void>;
}
