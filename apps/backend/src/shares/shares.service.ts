import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShareDto } from './dto/create-share.dto';
import { UpdateShareDto } from './dto/update-share.dto';

/**
 * Guest share links: lets a page owner/editor mint an opaque URL that anonymous
 * visitors can use to view a page without a Wikso account.
 *
 * Design decisions:
 * - Tokens are 192-bit `base64url` strings from crypto.randomBytes (≈32 chars).
 *   With 2^192 entropy, guessing is computationally infeasible; we still rate-limit
 *   the public endpoints in the controller layer.
 * - Passwords are hashed with bcrypt (10 rounds) and compared with the library's
 *   built-in timing-safe comparator.
 * - The "meta" resolve path returns only presence/expiry/requiresPassword so a
 *   password-gated link never leaks page content to someone who hasn't entered
 *   the password.
 * - Soft-revoke via `revokedAt` (audit-friendly); rows are deleted only on page
 *   cascade.
 */
@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);
  private static readonly BCRYPT_ROUNDS = 10;
  private static readonly TOKEN_BYTES = 24; // 192 bits → 32-char base64url string

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────────────────
  //   Authenticated API (page owners)
  // ──────────────────────────────────────────────────────────────────────────

  async createShare(pageId: string, slug: string, userId: string, dto: CreateShareDto) {
    await this.assertPageInSpace(pageId, slug);

    if (dto.expiresAt) {
      const expiresDate = new Date(dto.expiresAt);
      if (expiresDate.getTime() <= Date.now()) {
        throw new BadRequestException('expiresAt must be in the future');
      }
    }

    const token = this.generateToken();
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, SharesService.BCRYPT_ROUNDS)
      : null;

    const share = await this.prisma.pageShare.create({
      data: {
        pageId,
        token,
        createdById: userId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        passwordHash,
        allowComments: dto.allowComments ?? false,
      },
    });

    return this.toPublicShape(share);
  }

  async listShares(pageId: string, slug: string) {
    await this.assertPageInSpace(pageId, slug);

    const shares = await this.prisma.pageShare.findMany({
      where: { pageId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return shares.map((s) => ({
      ...this.toPublicShape(s),
      createdBy: s.createdBy,
    }));
  }

  async updateShare(shareId: string, pageId: string, slug: string, dto: UpdateShareDto) {
    // Joining via `page.space.slug` ensures the share row really belongs to a
    // page in the pathname's space — defends against IDOR where a user with
    // access to one space tries to mutate a share rooted in another.
    const existing = await this.prisma.pageShare.findFirst({
      where: { id: shareId, pageId, page: { space: { slug } } },
    });
    if (!existing) throw new NotFoundException('Share not found');

    const data: Record<string, unknown> = {};

    if (dto.expiresAt !== undefined) {
      if (dto.expiresAt === null) {
        data.expiresAt = null;
      } else {
        const d = new Date(dto.expiresAt);
        if (d.getTime() <= Date.now()) {
          throw new BadRequestException('expiresAt must be in the future');
        }
        data.expiresAt = d;
      }
    }

    if (dto.password !== undefined) {
      data.passwordHash =
        dto.password === null
          ? null
          : await bcrypt.hash(dto.password, SharesService.BCRYPT_ROUNDS);
    }

    if (dto.allowComments !== undefined) {
      data.allowComments = dto.allowComments;
    }

    const updated = await this.prisma.pageShare.update({
      where: { id: shareId },
      data,
    });

    return this.toPublicShape(updated);
  }

  async revokeShare(shareId: string, pageId: string, slug: string) {
    const existing = await this.prisma.pageShare.findFirst({
      where: { id: shareId, pageId, page: { space: { slug } } },
    });
    if (!existing) throw new NotFoundException('Share not found');

    if (existing.revokedAt) {
      return { message: 'Share already revoked', revokedAt: existing.revokedAt };
    }

    const updated = await this.prisma.pageShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });

    return { message: 'Share revoked', revokedAt: updated.revokedAt };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //   Public API (anonymous visitors, no JWT)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns lightweight metadata about a share without leaking page content.
   * Safe to call before any password has been provided.
   */
  async resolveShareMeta(token: string) {
    const share = await this.findActiveShareByToken(token);

    return {
      requiresPassword: share.passwordHash !== null,
      allowComments: share.allowComments,
      expiresAt: share.expiresAt,
      page: {
        id: share.page.id,
        title: share.page.title,
      },
    };
  }

  /**
   * Returns the page content for a share. If the share is password-protected,
   * `password` must match the bcrypt hash. Increments viewCount on success.
   */
  async resolveShareContent(token: string, password?: string) {
    const share = await this.findActiveShareByToken(token);

    if (share.passwordHash) {
      if (!password) throw new UnauthorizedException('Password required');
      const ok = await bcrypt.compare(password, share.passwordHash);
      if (!ok) throw new UnauthorizedException('Invalid password');
    }

    // Increment view counter — fire-and-forget so a counter hiccup can't block
    // the reader from seeing the page.
    this.prisma.pageShare
      .update({
        where: { id: share.id },
        data: {
          viewCount: { increment: 1 },
          lastViewedAt: new Date(),
        },
      })
      .catch((err) => this.logger.warn(`share view increment failed: ${err?.message}`));

    return {
      share: {
        id: share.id,
        allowComments: share.allowComments,
        expiresAt: share.expiresAt,
      },
      page: {
        id: share.page.id,
        title: share.page.title,
        slug: share.page.slug,
        contentJson: share.page.contentJson,
        updatedAt: share.page.updatedAt,
        author: share.page.author
          ? { name: share.page.author.name, avatarUrl: share.page.author.avatarUrl }
          : null,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //   Internals
  // ──────────────────────────────────────────────────────────────────────────

  private async findActiveShareByToken(token: string) {
    // Reject oversized input up front — tokens are always 32 chars. Saves an
    // index lookup on garbage and avoids any pathological DB behavior.
    if (!token || token.length < 16 || token.length > 128) {
      throw new NotFoundException('Share not found');
    }

    const share = await this.prisma.pageShare.findUnique({
      where: { token },
      include: {
        page: {
          include: {
            author: { select: { name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!share) throw new NotFoundException('Share not found');
    if (share.revokedAt) throw new GoneException('Share has been revoked');
    if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('Share has expired');
    }
    if (!share.page || share.page.deletedAt) {
      throw new NotFoundException('Shared page no longer exists');
    }

    return share;
  }

  /**
   * Confirms the page exists, isn't soft-deleted, AND lives in the given
   * space. The `space.slug` join is the IDOR defence — without it a user with
   * VIEWER+ in space "alpha" could pass a pageId that belongs to space "beta"
   * (the SpacePermissionGuard only authorises against the URL slug, not the
   * page-to-space binding).
   */
  private async assertPageInSpace(pageId: string, slug: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null, space: { slug } },
      select: { id: true },
    });
    if (!page) throw new NotFoundException('Page not found');
  }

  private generateToken(): string {
    return randomBytes(SharesService.TOKEN_BYTES).toString('base64url');
  }

  /** Strip passwordHash and any other secrets before returning a share to the client. */
  private toPublicShape(share: {
    id: string;
    token: string;
    pageId: string;
    expiresAt: Date | null;
    passwordHash: string | null;
    allowComments: boolean;
    viewCount: number;
    lastViewedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: share.id,
      pageId: share.pageId,
      token: share.token,
      hasPassword: share.passwordHash !== null,
      allowComments: share.allowComments,
      viewCount: share.viewCount,
      lastViewedAt: share.lastViewedAt,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
    };
  }
}
