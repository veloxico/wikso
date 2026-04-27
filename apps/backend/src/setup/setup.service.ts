import {
  Injectable,
  ForbiddenException,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AppConfigService } from '../config/app-config.service';
import { GlobalRole } from '@prisma/client';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { TestDbDto } from './dto/test-db.dto';
import { SaveDbDto } from './dto/save-db.dto';
import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { URL } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { promises as dnsPromises } from 'dns';
import { isIP } from 'net';
import { isBlockedHost } from '../common/utils/ssrf';

const execAsync = promisify(exec);

function sanitizeDbError(error: any): string {
  const code = error?.code;
  if (code === '28P01' || code === '28000') return 'Authentication failed. Check username and password.';
  if (code === 'ENOTFOUND') return 'Host not found. Check the hostname.';
  if (code === 'ECONNREFUSED') return 'Connection refused. Check host and port.';
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET') return 'Connection timed out.';
  if (code === '3D000') return 'Database does not exist.';
  if (code === '42501') return 'Insufficient privileges.';
  if (error?.message?.includes('self-signed certificate')) return 'Self-signed certificate detected. Disable certificate verification or provide a trusted certificate.';
  if (error?.message?.includes('SSL')) return 'SSL/TLS connection error. Check TLS settings.';
  return 'Connection failed. Check your connection settings.';
}

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private appConfig: AppConfigService,
  ) {}

  /**
   * Setup status — what stage is the wizard at?
   *
   *  needsDatabase: config file missing, no DB URL
   *  needsAdmin:    DB configured but no users yet
   *  complete:      setupCompletedAt is set
   */
  async getStatus(): Promise<{
    setupRequired: boolean;
    stage: 'database' | 'admin' | 'complete';
  }> {
    if (this.appConfig.isSetupComplete() && this.prisma.isReady) {
      return { setupRequired: false, stage: 'complete' };
    }
    if (!this.appConfig.hasDatabaseConfig() && !process.env.DATABASE_URL) {
      return { setupRequired: true, stage: 'database' };
    }
    // DB configured but no admin yet
    return { setupRequired: true, stage: 'admin' };
  }

  /**
   * Test a PostgreSQL connection without persisting anything.
   */
  async testDatabase(dto: TestDbDto) {
    await this.ensureSetupInProgress();
    return this.runConnectionTest(dto);
  }

  /**
   * Save DB config + run migrations + prepare for admin creation.
   *
   * Flow:
   *  1. Validate URL (no SSRF)
   *  2. Test connection with real credentials
   *  3. Persist config file
   *  4. Run `prisma migrate deploy`
   *  5. Return success; client must call /setup/init next
   *
   * After step 3, the process will need to be restarted for Prisma to pick up
   * the new URL. We signal the frontend which then triggers a container restart
   * (via Docker's restart policy after we exit).
   */
  async saveDatabase(dto: SaveDbDto): Promise<{
    success: boolean;
    message: string;
    requiresRestart: boolean;
  }> {
    await this.ensureSetupInProgress();

    // 1+2. Validate + test
    const testResult = await this.runConnectionTest(dto);
    if (!testResult.success) {
      throw new BadRequestException(testResult.message);
    }

    // 3. Persist config
    await this.appConfig.saveDatabaseConfig({
      url: dto.databaseUrl,
      useTls: dto.useTls ?? false,
      rejectUnauthorized: dto.rejectUnauthorized ?? true,
    });

    // 4. Run migrations (child process — Prisma CLI)
    try {
      await this.runMigrations(dto.databaseUrl);
    } catch (err: any) {
      this.logger.error(`Migration failed: ${err.message}`);
      throw new InternalServerErrorException(
        'Database configured but migration failed. Check backend logs.',
      );
    }

    // 5. The already-constructed PrismaClient can't swap connection URLs cleanly,
    //    so a process restart is always required. Docker's restart policy brings
    //    the container back up with the new config. We mirror the value into
    //    process.env so any non-Prisma readers see the new URL before restart.
    process.env.DATABASE_URL = dto.databaseUrl;

    return {
      success: true,
      message: 'Database configured and migrated successfully.',
      requiresRestart: true,
    };
  }

  /**
   * Create first admin user + default space.
   * Marks setup as complete.
   */
  async createAdmin(dto: SetupAdminDto) {
    if (!this.prisma.isReady) {
      throw new BadRequestException(
        'Database must be configured first. Visit /setup.',
      );
    }
    await this.ensureSetupInProgress();
    await this.ensureNoUsersExist();

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const admin = await this.prisma.$transaction(async (tx) => {
      const count = await tx.user.count();
      if (count > 0) {
        throw new ForbiddenException(
          'Setup already completed. At least one user exists.',
        );
      }

      const user = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
          emailVerified: true,
          role: GlobalRole.ADMIN,
        },
      });

      await tx.space.create({
        data: {
          name: dto.instanceName || 'General',
          slug: 'general',
          description: 'Default space',
          type: 'PUBLIC',
          ownerId: user.id,
        },
      });

      return user;
    });

    await this.appConfig.markSetupComplete();

    const tokens = await this.authService.login(admin);

    return {
      message: 'Setup complete. Admin user created.',
      ...tokens,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Gate for setup endpoints. Refuses if the wizard is already complete,
   * AND self-heals the upgrade-from-v2.5 edge case: if the runtime config file
   * is missing but the DB already contains users, this is a legitimate
   * existing install — auto-mark setup complete so /setup/save-db and
   * /setup/init can't be exploited to point the instance at an attacker DB
   * and seize global ADMIN.
   */
  private async ensureSetupInProgress(): Promise<void> {
    if (this.appConfig.isSetupComplete()) {
      throw new ForbiddenException('Setup already completed.');
    }
    if (this.prisma.isReady) {
      let userCount = 0;
      try {
        userCount = await this.prisma.user.count();
      } catch {
        // Schema not yet migrated, table missing, or DB unreachable — let
        // the legitimate fresh-install wizard flow proceed.
        return;
      }
      if (userCount > 0) {
        try {
          await this.appConfig.markSetupComplete();
        } catch (err: any) {
          this.logger.warn(
            `Auto-marking setup complete failed (likely missing config file on upgrade): ${err.message}`,
          );
        }
        throw new ForbiddenException('Setup already completed.');
      }
    }
  }

  private async ensureNoUsersExist() {
    // We're connected now — check DB directly
    const count = await this.prisma.user.count();
    if (count > 0) {
      // Mark setup complete if users exist (migration edge case)
      if (!this.appConfig.isSetupComplete()) {
        await this.appConfig.markSetupComplete();
      }
      throw new ForbiddenException(
        'Setup already completed. At least one user exists.',
      );
    }
  }

  private async runConnectionTest(dto: TestDbDto): Promise<{
    success: boolean;
    message: string;
    version?: string;
    database?: string;
  }> {
    // Validate URL shape
    let parsed: URL;
    try {
      parsed = new URL(dto.databaseUrl);
    } catch {
      return { success: false, message: 'Invalid connection URL format.' };
    }

    // SSRF: resolve the hostname to a numeric IP and validate against the
    // blocklist. This catches alternate IPv4 encodings (decimal, hex, octal,
    // dot-elided) that getaddrinfo() accepts but our regex would not, and
    // public DNS names that resolve to RFC1918 / loopback / metadata addresses.
    const rawHost = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '');
    if (!rawHost) {
      return { success: false, message: 'Invalid host in connection URL.' };
    }
    if (rawHost === 'localhost' || rawHost === '0.0.0.0' || rawHost === '::1') {
      return {
        success: false,
        message: 'Connection to internal/private network addresses is not allowed.',
      };
    }

    // Allow Docker-internal service hostnames so container-to-container
    // connections (e.g. `postgres`, `db`) keep working. These resolve only
    // inside Docker's user-defined network and never to public addresses.
    const DOCKER_INTERNAL_HOSTS = new Set(['postgres', 'db', 'database', 'pgdb']);
    let resolvedAddresses: string[] = [];
    if (isIP(rawHost)) {
      resolvedAddresses = [rawHost];
    } else if (DOCKER_INTERNAL_HOSTS.has(rawHost)) {
      // Trusted internal service name — skip DNS check, pg.Client will resolve via Docker DNS.
      resolvedAddresses = [];
    } else {
      try {
        const lookups = await dnsPromises.lookup(rawHost, { all: true });
        resolvedAddresses = lookups.map((l) => l.address);
      } catch {
        // DNS lookup failed — let pg.Client surface the proper ENOTFOUND below.
        resolvedAddresses = [];
      }
    }

    for (const addr of resolvedAddresses) {
      if (isBlockedHost(addr)) {
        return {
          success: false,
          message: 'Connection to internal/private network addresses is not allowed.',
        };
      }
    }

    const ssl = dto.useTls
      ? { rejectUnauthorized: dto.rejectUnauthorized ?? true }
      : false;

    const client = new Client({
      connectionString: dto.databaseUrl,
      ssl,
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      const versionResult = await client.query('SELECT version()');
      const dbResult = await client.query('SELECT current_database()');
      const version = versionResult.rows[0]?.version || 'unknown';
      const database = dbResult.rows[0]?.current_database || 'unknown';
      await client.end();
      return {
        success: true,
        message: 'Connection successful',
        version: version.split(',')[0],
        database,
      };
    } catch (error: any) {
      try { await client.end(); } catch {}
      return { success: false, message: sanitizeDbError(error) };
    }
  }

  /**
   * Run `prisma migrate deploy` against the given database URL.
   * Uses child_process to invoke the Prisma CLI.
   */
  private async runMigrations(databaseUrl: string): Promise<void> {
    // The Prisma schema lives at apps/backend/prisma/schema.prisma, which is at
    // a known path relative to the backend workdir in Docker (/app/apps/backend).
    const schemaPath = path.resolve(
      process.cwd(),
      'prisma',
      'schema.prisma',
    );

    this.logger.log(`Running migrations for schema at ${schemaPath}...`);
    const env = { ...process.env, DATABASE_URL: databaseUrl };
    const { stdout, stderr } = await execAsync(
      `npx prisma migrate deploy --schema="${schemaPath}"`,
      { env, timeout: 60_000 },
    );
    this.logger.log(`Migration stdout: ${stdout.trim()}`);
    if (stderr?.trim()) this.logger.warn(`Migration stderr: ${stderr.trim()}`);
  }
}
