import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';

/**
 * Prisma service with deferred initialization.
 *
 * Resolution order for DATABASE_URL:
 *   1. AppConfigService (persisted from setup wizard → /app/data/wikso.config.json)
 *   2. process.env.DATABASE_URL (legacy / manual config)
 *
 * If neither is available at boot, the client is constructed with a dummy URL
 * and $connect() is deferred. SetupGuard blocks all non-/setup/* routes in this state.
 * After the wizard completes, the process exits (code 0) and Docker restart policy
 * brings it back up with the saved config.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  constructor(appConfig: AppConfigService) {
    const resolvedUrl =
      appConfig.getDatabaseUrl() ??
      process.env.DATABASE_URL ??
      // Harmless placeholder — client is constructed but $connect() is skipped
      'postgresql://_unconfigured:_unconfigured@127.0.0.1:1/_unconfigured';

    super({
      datasourceUrl: resolvedUrl,
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    this._hasUrl = !!(appConfig.getDatabaseUrl() ?? process.env.DATABASE_URL);
  }

  private _hasUrl: boolean;

  async onModuleInit() {
    if (!this._hasUrl) {
      this.logger.warn(
        'No DATABASE_URL configured — setup wizard will be required',
      );
      return;
    }

    try {
      await this.connectWithRetry();

      (this as any).$on('error', (e: any) => {
        this.logger.error(`Prisma error: ${e.message}`);
      });
      (this as any).$on('warn', (e: any) => {
        this.logger.warn(`Prisma warn: ${e.message}`);
      });

      this.connected = true;
    } catch (err) {
      this.logger.error(
        `Initial DB connection failed: ${(err as Error).message}`,
      );
      // Don't throw — let the app boot in setup mode
    }
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.$disconnect().catch(() => {});
    }
  }

  get isReady(): boolean {
    return this.connected;
  }

  private async connectWithRetry(
    retries = 5,
    delayMs = 2000,
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connected');
        return;
      } catch (err) {
        this.logger.warn(
          `DB connect attempt ${attempt}/${retries} failed: ${(err as Error).message}`,
        );
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, delayMs * attempt));
      }
    }
  }
}
