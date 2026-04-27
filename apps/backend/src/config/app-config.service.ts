import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';

export interface WiksoConfig {
  configVersion: number;
  database: {
    url: string;
    useTls: boolean;
    rejectUnauthorized: boolean;
  };
  setupCompletedAt: string | null;
}

const CURRENT_CONFIG_VERSION = 1;

/**
 * Manages runtime configuration stored in a volume-mounted JSON file.
 * This is the source of truth for database connection and setup state.
 *
 * Loaded SYNCHRONOUSLY in the constructor so `PrismaService` (which depends
 * on this service and reads the URL from its constructor) gets the correct
 * value before Prisma is instantiated. onModuleInit runs *after* DI resolution,
 * so we can't rely on it for the initial load.
 *
 * Path priority:
 *  1. WIKSO_CONFIG_PATH env var (if set)
 *  2. /app/data/wikso.config.json (Docker volume mount)
 *  3. ./data/wikso.config.json (local dev fallback)
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  private readonly configPath: string;
  private config: WiksoConfig | null = null;

  constructor() {
    this.configPath = this.resolveConfigPath();
    this.loadSync();
  }

  private resolveConfigPath(): string {
    if (process.env.WIKSO_CONFIG_PATH) {
      return process.env.WIKSO_CONFIG_PATH;
    }
    const prodPath = '/app/data/wikso.config.json';
    const devPath = path.resolve(process.cwd(), 'data/wikso.config.json');
    // In Docker container, /app exists; locally we use ./data
    return process.env.NODE_ENV === 'production' ? prodPath : devPath;
  }

  /**
   * Load config from disk synchronously. Called from constructor so consumers
   * that read the URL in their own constructors (PrismaService) see the latest
   * value.
   */
  private loadSync(): void {
    try {
      const raw = fsSync.readFileSync(this.configPath, 'utf8');
      const parsed = JSON.parse(raw) as WiksoConfig;
      this.config = parsed;
      this.logger.log(
        `Config loaded from ${this.configPath} (setup ${parsed.setupCompletedAt ? 'complete' : 'in progress'})`,
      );
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        this.logger.warn(
          `No config file found at ${this.configPath} — setup wizard will be enabled`,
        );
        this.config = null;
        return;
      }
      this.logger.error(`Failed to read config: ${err.message}`);
      this.config = null;
    }
  }

  /**
   * Force reload config from disk (async version, useful after external writes).
   */
  async load(): Promise<WiksoConfig | null> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf8');
      const parsed = JSON.parse(raw) as WiksoConfig;
      this.config = parsed;
      return parsed;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        this.config = null;
        return null;
      }
      throw err;
    }
  }

  /**
   * Save config atomically (write to .tmp, then rename).
   */
  async save(config: WiksoConfig): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });

    const tmpPath = `${this.configPath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    await fs.rename(tmpPath, this.configPath);

    this.config = config;
    this.logger.log(`Config saved to ${this.configPath}`);
  }

  /**
   * Save database configuration. Creates initial config if none exists.
   */
  async saveDatabaseConfig(dbConfig: WiksoConfig['database']): Promise<void> {
    const config: WiksoConfig = {
      configVersion: CURRENT_CONFIG_VERSION,
      database: dbConfig,
      setupCompletedAt: this.config?.setupCompletedAt ?? null,
    };
    await this.save(config);
  }

  /**
   * Mark setup as complete (called after admin user is created).
   *
   * Two valid entry-points produce a config:
   *  1. Wizard flow → `saveDatabaseConfig()` already wrote the file.
   *  2. Env-driven install (local dev, or `DATABASE_URL` injected at
   *     runtime in container orchestrators) → no file yet, but the
   *     env var IS the source of truth. Bootstrap a config from it so
   *     subsequent restarts have a single canonical place to read from.
   *
   * Only refuses when neither source is available — that's the genuine
   * "called too early" error the original guard was protecting against.
   */
  async markSetupComplete(): Promise<void> {
    if (!this.config) {
      const envUrl = process.env.DATABASE_URL;
      if (!envUrl) {
        throw new Error(
          'Cannot mark setup complete before database config is saved',
        );
      }
      this.logger.log(
        'Bootstrapping config from DATABASE_URL env var (no wizard config file present)',
      );
      this.config = {
        configVersion: CURRENT_CONFIG_VERSION,
        database: {
          url: envUrl,
          useTls: false,
          rejectUnauthorized: true,
        },
        setupCompletedAt: null,
      };
    }
    await this.save({
      ...this.config,
      setupCompletedAt: new Date().toISOString(),
    });
  }

  /** Is the setup wizard fully done? */
  isSetupComplete(): boolean {
    return !!this.config?.setupCompletedAt;
  }

  /** Has a database URL been configured? */
  hasDatabaseConfig(): boolean {
    return !!this.config?.database?.url;
  }

  getDatabaseUrl(): string | null {
    return this.config?.database?.url ?? null;
  }

  getDatabaseConfig(): WiksoConfig['database'] | null {
    return this.config?.database ?? null;
  }

  getConfig(): WiksoConfig | null {
    return this.config;
  }
}
