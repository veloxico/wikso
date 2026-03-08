import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GlobalRole } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getUsers(skip = 0, take = 20) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip, take,
        select: { id: true, email: true, name: true, avatarUrl: true, role: true, emailVerified: true, createdAt: true },
      }),
      this.prisma.user.count(),
    ]);
    return { users, total };
  }

  async updateUser(id: string, data: { name?: string; role?: GlobalRole }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async deleteUser(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted' };
  }

  async getAuditLog(skip = 0, take = 50) {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip, take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { logs, total };
  }

  async getStats() {
    const [usersCount, spacesCount, pagesCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.space.count(),
      this.prisma.page.count(),
    ]);
    return { usersCount, spacesCount, pagesCount };
  }

  getAuthProviders() {
    return {
      local: {
        enabled: true,
        label: 'Email / Password',
      },
      google: {
        enabled: !!process.env.GOOGLE_CLIENT_ID,
        label: 'Google OAuth',
        clientIdConfigured: !!process.env.GOOGLE_CLIENT_ID,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'Not configured',
      },
      github: {
        enabled: !!process.env.GITHUB_CLIENT_ID,
        label: 'GitHub OAuth',
        clientIdConfigured: !!process.env.GITHUB_CLIENT_ID,
        callbackUrl: process.env.GITHUB_CALLBACK_URL || 'Not configured',
      },
      saml: {
        enabled: !!process.env.SAML_ENTRY_POINT,
        label: 'SAML SSO',
        entryPointConfigured: !!process.env.SAML_ENTRY_POINT,
        issuer: process.env.SAML_ISSUER || 'Not configured',
        callbackUrl: process.env.SAML_CALLBACK_URL || 'Not configured',
        certConfigured: !!process.env.SAML_CERT,
      },
    };
  }
}
