import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SystemSettings } from '@prisma/client';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const CACHE_KEY = 'cache:settings';
const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class SettingsService {
  private logger = new Logger(SettingsService.name);
  /** In-memory fallback if Redis is unavailable */
  private memoryCache: SystemSettings | null = null;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getSettings(): Promise<SystemSettings> {
    // Try Redis cache first
    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.memoryCache = parsed;
        return parsed;
      }
    } catch {
      // Redis unavailable — try memory cache
    }

    // Try in-memory fallback
    if (this.memoryCache) return this.memoryCache;

    let settings = await this.prisma.systemSettings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings) {
      settings = await this.prisma.systemSettings.create({
        data: {
          id: 'singleton',
          emailVerificationRequired:
            process.env.EMAIL_VERIFICATION_REQUIRED === 'true',
        },
      });
    }

    // Cache in Redis and memory
    this.memoryCache = settings;
    try {
      await this.redis.set(CACHE_KEY, JSON.stringify(settings), CACHE_TTL);
    } catch {
      // Non-critical
    }

    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<SystemSettings> {
    const settings = await this.prisma.systemSettings.update({
      where: { id: 'singleton' },
      data: dto,
    });

    // Update both caches
    this.memoryCache = settings;
    try {
      await this.redis.set(CACHE_KEY, JSON.stringify(settings), CACHE_TTL);
    } catch {
      // Non-critical
    }

    return settings;
  }

  async isRegistrationEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.registrationEnabled;
  }

  async isEmailDomainAllowed(email: string): Promise<boolean> {
    const settings = await this.getSettings();
    if (settings.allowedEmailDomains.length === 0) return true;
    const domain = email.split('@')[1]?.toLowerCase();
    return settings.allowedEmailDomains
      .map((d) => d.toLowerCase())
      .includes(domain);
  }

  async getPasswordMinLength(): Promise<number> {
    const settings = await this.getSettings();
    return settings.passwordMinLength;
  }

  async getPublicSettings() {
    const s = await this.getSettings();
    return {
      siteName: s.siteName,
      registrationEnabled: s.registrationEnabled,
    };
  }

  async invalidateCache() {
    this.memoryCache = null;
    try {
      await this.redis.del(CACHE_KEY);
    } catch {
      // Non-critical
    }
  }
}
