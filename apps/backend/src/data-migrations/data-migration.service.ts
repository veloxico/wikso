import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ALL_DATA_MIGRATIONS } from './migrations';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DataMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DataMigrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async onApplicationBootstrap() {
    await this.stampAppVersion();
    await this.runPendingMigrations();
    // Invalidate settings cache so the freshly-stamped appVersion
    // and any data-migration side-effects are visible immediately.
    await this.settingsService.invalidateCache();
  }

  /**
   * Write the current app version from package.json into SystemSettings.
   */
  private async stampAppVersion(): Promise<void> {
    try {
      const version = this.readPackageVersion();

      await this.prisma.systemSettings.upsert({
        where: { id: 'singleton' },
        update: { appVersion: version },
        create: { id: 'singleton', appVersion: version },
      });

      this.logger.log(`App version stamped: ${version}`);
    } catch (err) {
      this.logger.error(`Failed to stamp app version: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Read version from the nearest package.json.
   */
  private readPackageVersion(): string {
    try {
      // Works in both dev (src/) and prod (dist/)
      const candidates = [
        path.resolve(process.cwd(), 'package.json'),
        path.resolve(__dirname, '..', '..', 'package.json'),
        path.resolve(__dirname, '..', '..', '..', 'package.json'),
      ];

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          const pkg = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
          if (pkg.version) return pkg.version;
        }
      }

      return '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /**
   * Find and execute data migrations that haven't been applied yet.
   * Each migration runs in a transaction together with its tracking record.
   * On failure, the app crashes so Docker restarts and retries.
   */
  private async runPendingMigrations(): Promise<void> {
    try {
      // Get already-applied migration names
      const applied = await this.prisma.dataMigration.findMany({
        select: { name: true },
      });
      const appliedNames = new Set(applied.map((m) => m.name));

      // Filter pending
      const pending = ALL_DATA_MIGRATIONS.filter(
        (m) => !appliedNames.has(m.name),
      );

      if (pending.length === 0) {
        this.logger.log('No pending data migrations');
        return;
      }

      // Calculate batch number
      const lastBatch = await this.prisma.dataMigration.aggregate({
        _max: { batch: true },
      });
      const batch = (lastBatch._max.batch ?? 0) + 1;

      this.logger.log(
        `Running ${pending.length} data migration(s) — batch ${batch}`,
      );

      for (const migration of pending) {
        this.logger.log(`  → Running: ${migration.name} — ${migration.description}`);

        await this.prisma.$transaction(
          async (tx) => {
            // Execute the migration
            await migration.up(tx as any);

            // Record it
            await tx.dataMigration.create({
              data: {
                name: migration.name,
                batch,
              },
            });
          },
          {
            timeout: 5 * 60 * 1000, // 5 minutes
          },
        );

        this.logger.log(`  ✓ Completed: ${migration.name}`);
      }

      this.logger.log(`All ${pending.length} data migration(s) applied successfully`);
    } catch (err) {
      this.logger.error(
        `Data migration failed: ${(err as Error).message}. App will crash — Docker will restart and retry.`,
      );
      throw err;
    }
  }
}
