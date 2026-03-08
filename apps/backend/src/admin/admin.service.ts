import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { GlobalRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AdminService {
  private logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
    private authService: AuthService,
    private mailService: MailService,
  ) {}

  // ─── Users ─────────────────────────────────────────────

  async getUsers(skip = 0, take = 20, search?: string, role?: string, status?: string) {
    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role as GlobalRole;
    if (status) where.status = status as any;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          status: true,
          emailVerified: true,
          invitedBy: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
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

  async suspendUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
  }

  async activateUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async inviteUser(email: string, role: GlobalRole, name: string | undefined, invitedById: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('User with this email already exists');

    const displayName = name || email.split('@')[0];
    // Create user with temporary password hash (will be replaced on invite acceptance)
    const tempHash = await bcrypt.hash(Math.random().toString(36), 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name: displayName,
        passwordHash: tempHash,
        role,
        invitedBy: invitedById,
        emailVerified: false,
      },
    });

    // Create invite token
    const token = await this.authService.createInviteToken(user.id, email, displayName);

    // Send invitation email
    try {
      await this.mailService.sendInvitationEmail(email, displayName, token);
    } catch (e) {
      this.logger.warn(`Failed to send invitation email to ${email}: ${e.message}`);
    }

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  async bulkInvite(emails: string[], role: GlobalRole, invitedById: string) {
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const email of emails) {
      try {
        await this.inviteUser(email, role, undefined, invitedById);
        results.push({ email, success: true });
      } catch (e: any) {
        results.push({ email, success: false, error: e.message });
      }
    }

    return results;
  }

  // ─── Spaces ────────────────────────────────────────────

  async getSpaces(skip = 0, take = 20) {
    const [spaces, total] = await Promise.all([
      this.prisma.space.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { pages: true, permissions: true } },
        },
      }),
      this.prisma.space.count(),
    ]);
    return { spaces, total };
  }

  async deleteSpace(id: string) {
    const space = await this.prisma.space.findUnique({ where: { id } });
    if (!space) throw new NotFoundException('Space not found');
    await this.prisma.space.delete({ where: { id } });
    return { message: 'Space deleted' };
  }

  async updateSpace(id: string, data: { type?: string }) {
    return this.prisma.space.update({ where: { id }, data: data as any });
  }

  // ─── Audit Log ─────────────────────────────────────────

  async getAuditLog(
    skip = 0,
    take = 50,
    filters?: { action?: string; userId?: string; from?: string; to?: string; search?: string },
  ) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters?.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.search) {
      where.OR = [
        { action: { contains: filters.search, mode: 'insensitive' } },
        { entityType: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as any).gte = new Date(filters.from);
      if (filters.to) (where.createdAt as any).lte = new Date(filters.to);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { logs, total };
  }

  // ─── Stats ─────────────────────────────────────────────

  async getStats() {
    const [usersCount, spacesCount, pagesCount, commentsCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.space.count(),
      this.prisma.page.count(),
      this.prisma.comment.count(),
    ]);
    return { usersCount, spacesCount, pagesCount, commentsCount };
  }

  // ─── Auth Providers ────────────────────────────────────

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

  // ─── Email ─────────────────────────────────────────────

  getEmailStatus() {
    const host = process.env.MAIL_HOST || process.env.SMTP_HOST || '';
    const port = process.env.MAIL_PORT || process.env.SMTP_PORT || '';
    const from = process.env.MAIL_FROM || process.env.SMTP_FROM || '';
    return {
      configured: !!host,
      host: host || 'Not configured',
      port: port || 'Not configured',
      from: from || 'Not configured',
    };
  }

  async sendTestEmail(adminEmail: string) {
    const host = process.env.MAIL_HOST || process.env.SMTP_HOST || 'localhost';
    const port = parseInt(process.env.MAIL_PORT || process.env.SMTP_PORT || '587');
    const user = process.env.MAIL_USER || process.env.SMTP_USER;
    const pass = process.env.MAIL_PASS || process.env.SMTP_PASS;

    const transporter = nodemailer.createTransport({
      host,
      port,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_FROM || 'noreply@example.com',
        to: adminEmail,
        subject: 'Dokka — Test Email',
        html: '<h2>Email configuration is working!</h2><p>This is a test email from Dokka admin panel.</p>',
      });
      return { success: true, message: `Test email sent to ${adminEmail}` };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  // ─── Webhooks ──────────────────────────────────────────

  async getWebhooks(skip = 0, take = 20) {
    const [webhooks, total] = await Promise.all([
      this.prisma.webhook.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.webhook.count(),
    ]);
    return { webhooks, total };
  }

  async toggleWebhook(id: string, active: boolean) {
    return this.prisma.webhook.update({ where: { id }, data: { active } });
  }
}
