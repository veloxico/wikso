import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettings } from '@prisma/client';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  private cache: SystemSettings | null = null;

  constructor(private prisma: PrismaService) {}

  async getSettings(): Promise<SystemSettings> {
    if (this.cache) return this.cache;

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

    this.cache = settings;
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<SystemSettings> {
    const settings = await this.prisma.systemSettings.update({
      where: { id: 'singleton' },
      data: dto,
    });
    this.cache = settings;
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

  invalidateCache() {
    this.cache = null;
  }
}
