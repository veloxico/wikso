import { Injectable, ConflictException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { PagesService } from '../pages/pages.service';
import { GlobalRole, Prisma, SpaceType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { encrypt, decrypt } from '../common/utils/encryption';
import { getAvailableProviders, maskConfig, mergeConfigWithExisting } from '../mail/providers/provider-factory';
import { EmailProviderType } from '../mail/providers/email-provider.interface';

@Injectable()
export class AdminService {
  private logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
    private authService: AuthService,
    private mailService: MailService,
    private pagesService: PagesService,
  ) {}

  // ─── Users ─────────────────────────────────────────────

  async createUser(email: string, name: string, password: string, role: GlobalRole = GlobalRole.USER) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('User with this email already exists');

    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { email, name, passwordHash, role, emailVerified: true, status: 'ACTIVE' },
      select: AdminService.SAFE_USER_SELECT,
    });
  }

  async setPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: 'Password updated' };
  }

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
          lastLoginAt: true,
          lastLoginIp: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total };
  }

  private static readonly SAFE_USER_SELECT = {
    id: true, email: true, name: true, avatarUrl: true, role: true,
    status: true, emailVerified: true, createdAt: true,
    lastLoginAt: true, lastLoginIp: true,
  } as const;

  async updateUser(id: string, data: { name?: string; role?: GlobalRole }) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: AdminService.SAFE_USER_SELECT,
    });
  }

  async deleteUser(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    // Prevent deleting the last admin
    const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === GlobalRole.ADMIN) {
      const adminCount = await this.prisma.user.count({ where: { role: GlobalRole.ADMIN } });
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot delete the last admin account');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Transfer space ownership to the admin performing the deletion
      await tx.space.updateMany({ where: { ownerId: id }, data: { ownerId: currentUserId } });
      // Nullify references that support null
      await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.pageView.updateMany({ where: { userId: id }, data: { userId: null } });
      // Reassign authored content to the admin performing the deletion
      await tx.pageVersion.updateMany({ where: { authorId: id }, data: { authorId: currentUserId } });
      await tx.page.updateMany({ where: { authorId: id }, data: { authorId: currentUserId } });
      // Delete reactions on user's comments, then comments themselves
      const userCommentIds = (await tx.comment.findMany({ where: { authorId: id }, select: { id: true } })).map(c => c.id);
      if (userCommentIds.length > 0) {
        await tx.commentReaction.deleteMany({ where: { commentId: { in: userCommentIds } } });
      }
      // Delete user's own reactions
      await tx.commentReaction.deleteMany({ where: { userId: id } });
      // Delete child comments first (replies), then parent comments
      await tx.comment.deleteMany({ where: { authorId: id, parentId: { not: null } } });
      await tx.comment.deleteMany({ where: { authorId: id } });
      // Now safe to delete — remaining cascade relations handle the rest
      await tx.user.delete({ where: { id } });
    });

    return { message: 'User deleted' };
  }

  async suspendUser(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('You cannot suspend your own account');
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: 'SUSPENDED' },
      select: AdminService.SAFE_USER_SELECT,
    });
  }

  async activateUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: AdminService.SAFE_USER_SELECT,
    });
  }

  async bulkSuspendUsers(userIds: string[], adminId: string) {
    // Filter out admin's own ID and users who are admins
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, role: true },
    });

    const idsToSuspend = users
      .filter((u) => u.id !== adminId && u.role !== GlobalRole.ADMIN)
      .map((u) => u.id);

    if (idsToSuspend.length === 0) {
      return { suspended: 0, skipped: userIds.length };
    }

    await this.prisma.user.updateMany({
      where: { id: { in: idsToSuspend } },
      data: { status: 'SUSPENDED' },
    });

    return { suspended: idsToSuspend.length, skipped: userIds.length - idsToSuspend.length };
  }

  async bulkDeleteUsers(userIds: string[], adminId: string) {
    // Filter out admin's own ID and users who are admins
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, role: true },
    });

    const idsToDelete = users
      .filter((u) => u.id !== adminId && u.role !== GlobalRole.ADMIN)
      .map((u) => u.id);

    if (idsToDelete.length === 0) {
      return { deleted: 0, skipped: userIds.length };
    }

    await this.prisma.$transaction(async (tx) => {
      const where = { in: idsToDelete };
      await tx.space.updateMany({ where: { ownerId: { in: idsToDelete } }, data: { ownerId: adminId } });
      await tx.auditLog.updateMany({ where: { userId: { in: idsToDelete } }, data: { userId: null } });
      await tx.pageView.updateMany({ where: { userId: { in: idsToDelete } }, data: { userId: null } });
      await tx.webhook.deleteMany({ where: { userId: { in: idsToDelete } } });
      await tx.comment.deleteMany({ where: { authorId: { in: idsToDelete } } });
      await tx.pageVersion.updateMany({ where: { authorId: { in: idsToDelete } }, data: { authorId: adminId } });
      await tx.page.updateMany({ where: { authorId: { in: idsToDelete } }, data: { authorId: adminId } });
      await tx.user.deleteMany({ where: { id: { in: idsToDelete } } });
    });

    return { deleted: idsToDelete.length, skipped: userIds.length - idsToDelete.length };
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

  async getSpaces(skip = 0, take = 20, search?: string, type?: SpaceType) {
    const where: Prisma.SpaceWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (type && Object.values(SpaceType).includes(type)) {
      where.type = type;
    }

    const [spaces, total] = await Promise.all([
      this.prisma.space.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { pages: true, permissions: true } },
        },
      }),
      this.prisma.space.count({ where }),
    ]);
    return { spaces, total };
  }

  async deleteSpace(id: string) {
    const space = await this.prisma.space.findUnique({ where: { id } });
    if (!space) throw new NotFoundException('Space not found');
    await this.prisma.space.delete({ where: { id } });
    return { message: 'Space deleted' };
  }

  async updateSpace(id: string, data: { name?: string; description?: string; type?: string; ownerId?: string }) {
    const space = await this.prisma.space.findUnique({ where: { id } });
    if (!space) throw new NotFoundException('Space not found');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.ownerId !== undefined) {
      const owner = await this.prisma.user.findUnique({ where: { id: data.ownerId } });
      if (!owner) throw new NotFoundException('Owner user not found');
      updateData.ownerId = data.ownerId;
    }

    return this.prisma.space.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { pages: true, permissions: true } },
      },
    });
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
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [usersCount, spacesCount, pagesCount, commentsCount, views7d, views30d, activeUsers7d] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.space.count(),
        this.prisma.page.count({ where: { deletedAt: null } }),
        this.prisma.comment.count(),
        this.prisma.pageView.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        this.prisma.pageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        this.prisma.pageView
          .groupBy({ by: ['userId'], where: { createdAt: { gte: sevenDaysAgo }, userId: { not: null } } })
          .then((g) => g.length),
      ]);

    return { usersCount, spacesCount, pagesCount, commentsCount, views7d, views30d, activeUsers7d };
  }

  // ─── Activity Stats ──────────────────────────────────────

  private static readonly PERIOD_CONFIG: Record<string, { ms: number; groupBy: 'hour' | 'day'; slots: number }> = {
    '12h': { ms: 12 * 60 * 60 * 1000,      groupBy: 'hour', slots: 12 },
    '6h':  { ms: 6 * 60 * 60 * 1000,       groupBy: 'hour', slots: 6 },
    '24h': { ms: 24 * 60 * 60 * 1000,      groupBy: 'hour', slots: 24 },
    '7d':  { ms: 7 * 24 * 60 * 60 * 1000,  groupBy: 'day',  slots: 7 },
    '14d': { ms: 14 * 24 * 60 * 60 * 1000, groupBy: 'day',  slots: 14 },
    '30d': { ms: 30 * 24 * 60 * 60 * 1000, groupBy: 'day',  slots: 30 },
  };

  async getActivityStats(period: string = '30d') {
    const config = AdminService.PERIOD_CONFIG[period] || AdminService.PERIOD_CONFIG['30d'];
    const since = new Date(Date.now() - config.ms);

    if (config.groupBy === 'hour') {
      return this.getActivityByHour(since, config.slots);
    }
    return this.getActivityByDay(since, config.slots);
  }

  private async getActivityByDay(since: Date, slots: number) {
    const [usersPerDay, pagesPerDay, viewsPerDay] = await Promise.all([
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
        FROM "User"
        WHERE "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
        FROM "Page"
        WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
        FROM "PageView"
        WHERE "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,
    ]);

    const usersMap = new Map(usersPerDay.map((r) => [new Date(r.date).toISOString().slice(0, 10), Number(r.count)]));
    const pagesMap = new Map(pagesPerDay.map((r) => [new Date(r.date).toISOString().slice(0, 10), Number(r.count)]));
    const viewsMap = new Map(viewsPerDay.map((r) => [new Date(r.date).toISOString().slice(0, 10), Number(r.count)]));

    const result: { date: string; users: number; pages: number; views: number }[] = [];
    for (let i = slots - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({
        date: key,
        users: usersMap.get(key) || 0,
        pages: pagesMap.get(key) || 0,
        views: viewsMap.get(key) || 0,
      });
    }

    return result;
  }

  private async getActivityByHour(since: Date, slots: number) {
    const [usersPerHour, pagesPerHour, viewsPerHour] = await Promise.all([
      this.prisma.$queryRaw<{ hour: string; count: bigint }[]>`
        SELECT date_trunc('hour', "createdAt") as hour, COUNT(*)::bigint as count
        FROM "User"
        WHERE "createdAt" >= ${since}
        GROUP BY date_trunc('hour', "createdAt")
        ORDER BY hour
      `,
      this.prisma.$queryRaw<{ hour: string; count: bigint }[]>`
        SELECT date_trunc('hour', "createdAt") as hour, COUNT(*)::bigint as count
        FROM "Page"
        WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL
        GROUP BY date_trunc('hour', "createdAt")
        ORDER BY hour
      `,
      this.prisma.$queryRaw<{ hour: string; count: bigint }[]>`
        SELECT date_trunc('hour', "createdAt") as hour, COUNT(*)::bigint as count
        FROM "PageView"
        WHERE "createdAt" >= ${since}
        GROUP BY date_trunc('hour', "createdAt")
        ORDER BY hour
      `,
    ]);

    const usersMap = new Map(usersPerHour.map((r) => [new Date(r.hour).toISOString().slice(0, 13), Number(r.count)]));
    const pagesMap = new Map(pagesPerHour.map((r) => [new Date(r.hour).toISOString().slice(0, 13), Number(r.count)]));
    const viewsMap = new Map(viewsPerHour.map((r) => [new Date(r.hour).toISOString().slice(0, 13), Number(r.count)]));

    const result: { date: string; users: number; pages: number; views: number }[] = [];
    const now = new Date();
    for (let i = slots - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 13); // "2024-01-15T14"
      result.push({
        date: d.toISOString(),
        users: usersMap.get(key) || 0,
        pages: pagesMap.get(key) || 0,
        views: viewsMap.get(key) || 0,
      });
    }

    return result;
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
    return this.mailService.getStatus();
  }

  async sendTestEmail(adminEmail: string) {
    return this.mailService.sendTestEmail(adminEmail);
  }

  getEmailProviders() {
    return getAvailableProviders();
  }

  async getEmailConfig() {
    const settings = await this.settingsService.getSettings();
    if (!settings.emailProvider) {
      return { provider: '', config: {}, fromAddress: '', fromName: '' };
    }

    let config: Record<string, any> = {};
    if (settings.emailProviderConfig) {
      try {
        const raw = JSON.parse(decrypt(settings.emailProviderConfig));
        config = maskConfig(settings.emailProvider as EmailProviderType, raw);
      } catch {
        config = {};
      }
    }

    return {
      provider: settings.emailProvider,
      config,
      fromAddress: settings.emailFromAddress,
      fromName: settings.emailFromName,
    };
  }

  async saveEmailConfig(data: {
    provider: string;
    config: Record<string, any>;
    fromAddress?: string;
    fromName?: string;
  }) {
    // Merge with existing config to preserve masked password fields
    let configToSave = data.config;
    const settings = await this.settingsService.getSettings();
    if (settings.emailProviderConfig && settings.emailProvider === data.provider) {
      try {
        const existingConfig = JSON.parse(decrypt(settings.emailProviderConfig));
        configToSave = mergeConfigWithExisting(
          data.provider as EmailProviderType,
          data.config,
          existingConfig,
        );
      } catch {
        // If decryption fails, use incoming config as-is
      }
    }

    const encrypted = encrypt(JSON.stringify(configToSave));

    await this.prisma.systemSettings.update({
      where: { id: 'singleton' },
      data: {
        emailProvider: data.provider,
        emailProviderConfig: encrypted,
        emailFromAddress: data.fromAddress || '',
        emailFromName: data.fromName || '',
      },
    });

    // Invalidate settings cache so MailService picks up new config
    await this.settingsService.invalidateCache();
    // Reload the email provider
    await this.mailService.reloadProvider();

    return { success: true, message: `Email provider "${data.provider}" configured successfully` };
  }

  async deleteEmailConfig() {
    await this.prisma.systemSettings.update({
      where: { id: 'singleton' },
      data: {
        emailProvider: '',
        emailProviderConfig: '',
        emailFromAddress: '',
        emailFromName: '',
      },
    });

    await this.settingsService.invalidateCache();
    await this.mailService.reloadProvider();

    return { success: true, message: 'Email configuration cleared. Falling back to environment variables.' };
  }

  // ─── Trash ───────────────────────────────────────────────

  async getTrash(skip = 0, take = 20, search?: string, spaceId?: string) {
    const where: Prisma.PageWhereInput = {
      deletedAt: { not: null },
    };
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (spaceId) {
      where.spaceId = spaceId;
    }

    const [pages, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        skip,
        take,
        orderBy: { deletedAt: 'desc' },
        include: {
          space: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true } },
        },
      }),
      this.prisma.page.count({ where }),
    ]);
    return { pages, total };
  }

  async restorePage(pageId: string) {
    return this.pagesService.restore(pageId);
  }

  async permanentDeletePage(pageId: string) {
    return this.pagesService.permanentDelete(pageId);
  }

  async bulkRestorePages(pageIds: string[]) {
    const results: { pageId: string; success: boolean; error?: string }[] = [];
    for (const pageId of pageIds) {
      try {
        await this.pagesService.restore(pageId);
        results.push({ pageId, success: true });
      } catch (e: any) {
        results.push({ pageId, success: false, error: e.message });
      }
    }
    return { results, restored: results.filter((r) => r.success).length };
  }

  async bulkPermanentDeletePages(pageIds: string[]) {
    const results: { pageId: string; success: boolean; error?: string }[] = [];
    for (const pageId of pageIds) {
      try {
        await this.pagesService.permanentDelete(pageId);
        results.push({ pageId, success: true });
      } catch (e: any) {
        results.push({ pageId, success: false, error: e.message });
      }
    }
    return { results, deleted: results.filter((r) => r.success).length };
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

  async createWebhook(data: { url: string; events: string[]; secret?: string; userId: string }) {
    return this.prisma.webhook.create({
      data: {
        url: data.url,
        events: data.events,
        secret: data.secret || null,
        active: true,
        userId: data.userId,
      },
    });
  }

  async updateWebhook(id: string, data: { url?: string; events?: string[]; secret?: string; active?: boolean }) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return this.prisma.webhook.update({ where: { id }, data });
  }

  async deleteWebhook(id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    await this.prisma.webhook.delete({ where: { id } });
    return { message: 'Webhook deleted' };
  }
}
