import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebClient } from '@slack/web-api';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { encrypt, decrypt } from '../../common/utils/encryption';
import { SlackPageEvent } from './dto/create-subscription.dto';

const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const OAUTH_STATE_PREFIX = 'slack:oauth:state:';

// Minimal bot scopes: read channels + post messages + handle link unfurls.
const SLACK_BOT_SCOPES = ['channels:read', 'chat:write', 'links:read', 'links:write'];

export interface SlackEventBody {
  token?: string;
  type: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type: string;
    channel?: string;
    message_ts?: string;
    user?: string;
    links?: Array<{ url: string; domain: string }>;
  };
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Configuration helpers ─────────────────────────────

  private getClientId(): string {
    const v = process.env.SLACK_CLIENT_ID || '';
    if (!v) throw new BadRequestException('SLACK_CLIENT_ID is not configured');
    return v;
  }

  private getClientSecret(): string {
    const v = process.env.SLACK_CLIENT_SECRET || '';
    if (!v) throw new BadRequestException('SLACK_CLIENT_SECRET is not configured');
    return v;
  }

  private getSigningSecret(): string {
    return process.env.SLACK_SIGNING_SECRET || '';
  }

  private getRedirectUrl(): string {
    return (
      process.env.SLACK_REDIRECT_URL ||
      'http://localhost:3000/api/v1/integrations/slack/oauth/callback'
    );
  }

  private getFrontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3001';
  }

  // ─── OAuth flow ────────────────────────────────────────

  /** Generate the OAuth install URL with a Redis-backed CSRF state. */
  async startOAuth(userId: string): Promise<{ url: string }> {
    const clientId = this.getClientId();
    const state = randomBytes(24).toString('hex');
    await this.redis.set(
      `${OAUTH_STATE_PREFIX}${state}`,
      JSON.stringify({ userId, createdAt: Date.now() }),
      OAUTH_STATE_TTL_SECONDS,
    );

    const params = new URLSearchParams({
      client_id: clientId,
      scope: SLACK_BOT_SCOPES.join(','),
      redirect_uri: this.getRedirectUrl(),
      state,
    });
    return { url: `https://slack.com/oauth/v2/authorize?${params.toString()}` };
  }

  /** Exchange an OAuth code for a bot token and persist the workspace. */
  async handleOAuthCallback(
    code: string,
    state: string,
  ): Promise<{ redirectUrl: string }> {
    const frontend = this.getFrontendUrl();
    const redirectBase = `${frontend}/admin/integrations/slack`;

    if (!code || !state) {
      return { redirectUrl: `${redirectBase}?status=error&reason=missing_params` };
    }

    const stateKey = `${OAUTH_STATE_PREFIX}${state}`;
    const stored = await this.redis.get(stateKey);
    if (!stored) {
      return { redirectUrl: `${redirectBase}?status=error&reason=invalid_state` };
    }
    await this.redis.del(stateKey);

    let parsed: { userId: string };
    try {
      parsed = JSON.parse(stored);
    } catch {
      return { redirectUrl: `${redirectBase}?status=error&reason=invalid_state` };
    }

    // Exchange code → bot token via slack.oauth.v2.access
    const client = new WebClient();
    let result: any;
    try {
      result = await client.oauth.v2.access({
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        code,
        redirect_uri: this.getRedirectUrl(),
      });
    } catch (err: any) {
      this.logger.error(`Slack OAuth exchange failed: ${err?.message || err}`);
      return { redirectUrl: `${redirectBase}?status=error&reason=oauth_failed` };
    }

    if (!result?.ok || !result.access_token || !result.team?.id) {
      return { redirectUrl: `${redirectBase}?status=error&reason=oauth_failed` };
    }

    const teamId: string = result.team.id;
    const teamName: string = result.team.name || 'Slack workspace';
    const botToken: string = result.access_token;
    const botUserId: string = result.bot_user_id || '';
    const encryptedToken = encrypt(botToken);

    await this.prisma.slackWorkspace.upsert({
      where: { slackTeamId: teamId },
      create: {
        slackTeamId: teamId,
        slackTeamName: teamName,
        botAccessToken: encryptedToken,
        botUserId,
        connectedByUserId: parsed.userId,
      },
      update: {
        slackTeamName: teamName,
        botAccessToken: encryptedToken,
        botUserId,
        connectedByUserId: parsed.userId,
      },
    });

    return { redirectUrl: `${redirectBase}?status=connected` };
  }

  // ─── Workspace management ──────────────────────────────

  async getWorkspace(): Promise<{
    id: string;
    slackTeamId: string;
    slackTeamName: string;
    botUserId: string;
    connectedByUserId: string;
    connectedAt: Date;
  } | null> {
    const ws = await this.prisma.slackWorkspace.findFirst({
      orderBy: { connectedAt: 'desc' },
    });
    if (!ws) return null;
    return {
      id: ws.id,
      slackTeamId: ws.slackTeamId,
      slackTeamName: ws.slackTeamName,
      botUserId: ws.botUserId,
      connectedByUserId: ws.connectedByUserId,
      connectedAt: ws.connectedAt,
    };
  }

  async disconnectWorkspace(): Promise<{ message: string }> {
    const ws = await this.prisma.slackWorkspace.findFirst();
    if (!ws) throw new NotFoundException('No Slack workspace connected');

    // Best-effort: revoke the token in Slack before deleting locally
    try {
      const token = decrypt(ws.botAccessToken);
      const client = new WebClient(token);
      await client.auth.revoke();
    } catch (err: any) {
      this.logger.warn(`Slack auth.revoke failed: ${err?.message || err}`);
    }

    await this.prisma.slackWorkspace.delete({ where: { id: ws.id } });
    return { message: 'Slack workspace disconnected' };
  }

  private async getActiveWorkspaceOrThrow() {
    const ws = await this.prisma.slackWorkspace.findFirst();
    if (!ws) throw new NotFoundException('No Slack workspace connected');
    return ws;
  }

  private getClientForWorkspace(encryptedToken: string): WebClient {
    const token = decrypt(encryptedToken);
    return new WebClient(token);
  }

  // ─── Channels / Subscriptions ──────────────────────────

  async listChannels(): Promise<
    { id: string; name: string; isPrivate: boolean; isMember: boolean }[]
  > {
    const ws = await this.getActiveWorkspaceOrThrow();
    const client = this.getClientForWorkspace(ws.botAccessToken);

    const channels: { id: string; name: string; isPrivate: boolean; isMember: boolean }[] = [];
    let cursor: string | undefined;
    // Bound iterations to avoid runaway pagination.
    for (let i = 0; i < 10; i++) {
      const res: any = await client.conversations.list({
        exclude_archived: true,
        types: 'public_channel,private_channel',
        limit: 200,
        cursor,
      });
      if (!res?.ok) break;
      for (const c of res.channels || []) {
        channels.push({
          id: c.id,
          name: c.name,
          isPrivate: !!c.is_private,
          isMember: !!c.is_member,
        });
      }
      cursor = res.response_metadata?.next_cursor || undefined;
      if (!cursor) break;
    }
    channels.sort((a, b) => a.name.localeCompare(b.name));
    return channels;
  }

  async listSubscriptions() {
    const subs = await this.prisma.slackChannelSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        space: { select: { id: true, slug: true, name: true } },
      },
    });
    return subs.map((s) => ({
      id: s.id,
      slackChannelId: s.slackChannelId,
      slackChannelName: s.slackChannelName,
      spaceId: s.spaceId,
      spaceSlug: s.space?.slug,
      spaceName: s.space?.name,
      eventTypes: s.eventTypes,
      createdAt: s.createdAt,
    }));
  }

  async subscribeChannel(
    slackChannelId: string,
    slackChannelName: string,
    spaceId: string,
    eventTypes: SlackPageEvent[],
  ) {
    const ws = await this.getActiveWorkspaceOrThrow();

    // Confirm the space exists.
    const space = await this.prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) throw new NotFoundException('Space not found');

    try {
      return await this.prisma.slackChannelSubscription.create({
        data: {
          workspaceId: ws.id,
          slackChannelId,
          slackChannelName,
          spaceId,
          eventTypes,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(
          'This Slack channel is already subscribed to the chosen space',
        );
      }
      throw err;
    }
  }

  async unsubscribeChannel(id: string) {
    const sub = await this.prisma.slackChannelSubscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    await this.prisma.slackChannelSubscription.delete({ where: { id } });
    return { message: 'Subscription removed' };
  }

  // ─── Posting ───────────────────────────────────────────

  async postToChannel(channelId: string, blocks: any[], text: string): Promise<void> {
    const ws = await this.prisma.slackWorkspace.findFirst();
    if (!ws) return;
    const client = this.getClientForWorkspace(ws.botAccessToken);
    try {
      await client.chat.postMessage({ channel: channelId, text, blocks });
    } catch (err: any) {
      this.logger.warn(`Slack postMessage failed for ${channelId}: ${err?.message || err}`);
    }
  }

  // ─── Events API (signature verification + routing) ─────

  /**
   * Verify the Slack request signature per
   * https://api.slack.com/authentication/verifying-requests-from-slack
   */
  verifySlackSignature(
    rawBody: string,
    timestamp: string | undefined,
    signature: string | undefined,
  ): boolean {
    const signingSecret = this.getSigningSecret();
    if (!signingSecret || !timestamp || !signature) return false;

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;
    // Reject if timestamp is older than 5 minutes (replay protection).
    if (Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false;

    const base = `v0:${timestamp}:${rawBody}`;
    const hmac = createHmac('sha256', signingSecret).update(base).digest('hex');
    const expected = `v0=${hmac}`;
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /** Route a verified Slack event payload. */
  async handleEvent(body: SlackEventBody): Promise<any> {
    if (body.type === 'url_verification' && body.challenge) {
      return { challenge: body.challenge };
    }

    if (body.type === 'event_callback' && body.event) {
      if (body.event.type === 'link_shared' && body.event.links?.length) {
        const unfurls = await this.handleLinkUnfurl(body.event);
        if (unfurls && body.event.channel && body.event.message_ts) {
          const ws = body.team_id
            ? await this.prisma.slackWorkspace.findUnique({ where: { slackTeamId: body.team_id } })
            : await this.prisma.slackWorkspace.findFirst();
          if (ws) {
            const client = this.getClientForWorkspace(ws.botAccessToken);
            try {
              await client.chat.unfurl({
                channel: body.event.channel,
                ts: body.event.message_ts,
                unfurls,
              });
            } catch (err: any) {
              this.logger.warn(`chat.unfurl failed: ${err?.message || err}`);
            }
          }
        }
      }
    }
    return { ok: true };
  }

  /**
   * Build per-URL unfurl payloads for any Wikso page links in the Slack event.
   * Returns a map keyed by the original URL → Slack blocks, as expected by chat.unfurl.
   */
  async handleLinkUnfurl(event: {
    links?: Array<{ url: string; domain: string }>;
  }): Promise<Record<string, { blocks: any[] }> | null> {
    if (!event.links?.length) return null;

    const frontendUrl = this.getFrontendUrl();
    let host: string;
    try {
      host = new URL(frontendUrl).host;
    } catch {
      host = '';
    }

    const unfurls: Record<string, { blocks: any[] }> = {};
    for (const link of event.links) {
      let url: URL;
      try {
        url = new URL(link.url);
      } catch {
        continue;
      }
      // Only unfurl links that point at this Wikso instance.
      if (host && url.host !== host) continue;

      // Wikso page URLs look like: /spaces/{slug}/pages/{pageId}
      const match = url.pathname.match(/\/spaces\/[^/]+\/pages\/([a-f0-9-]{8,})/i);
      if (!match) continue;
      const pageId = match[1];

      const page = await this.prisma.page.findUnique({
        where: { id: pageId },
        include: {
          author: { select: { id: true, name: true } },
          space: { select: { slug: true, name: true } },
        },
      });
      if (!page || page.deletedAt) continue;

      const snippet = this.extractSnippet(page.contentJson);
      const blocks: any[] = [
        {
          type: 'header',
          text: { type: 'plain_text', text: page.title || 'Untitled', emoji: true },
        },
      ];
      if (snippet) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: snippet },
        });
      }
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `:memo: *${page.space?.name || 'Space'}* · by ${page.author?.name || 'Unknown'}`,
          },
        ],
      });
      unfurls[link.url] = { blocks };
    }

    return Object.keys(unfurls).length ? unfurls : null;
  }

  /** Extract a plain-text snippet (~280 chars) from a Tiptap/ProseMirror JSON doc. */
  private extractSnippet(content: unknown, maxLen = 280): string {
    if (!content || typeof content !== 'object') return '';
    const parts: string[] = [];
    const walk = (node: any) => {
      if (!node || parts.join(' ').length >= maxLen) return;
      if (typeof node.text === 'string') {
        parts.push(node.text);
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) walk(child);
      }
    };
    walk(content);
    const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
    return joined.length > maxLen ? joined.slice(0, maxLen - 1) + '…' : joined;
  }

  // ─── Page-event hook ───────────────────────────────────

  /**
   * Listen for internal page events fired via the NestJS EventEmitter.
   * PagesService emits `page.created | page.updated | page.deleted` with
   * the same payload shape used by the existing webhooks system.
   */
  @OnEvent('page.created', { async: true })
  async handlePageCreated(payload: any) {
    await this.onPageEvent('page.created', payload);
  }

  @OnEvent('page.updated', { async: true })
  async handlePageUpdated(payload: any) {
    await this.onPageEvent('page.updated', payload);
  }

  @OnEvent('page.deleted', { async: true })
  async handlePageDeleted(payload: any) {
    await this.onPageEvent('page.deleted', payload);
  }

  async onPageEvent(type: SlackPageEvent, payload: any): Promise<void> {
    try {
      const spaceSlug: string | undefined = payload?.spaceSlug;
      const pageId: string | undefined = payload?.pageId;
      if (!pageId) return;

      // Resolve the space id — the event payload may only carry the slug.
      let spaceId: string | undefined = payload?.spaceId;
      if (!spaceId && spaceSlug) {
        const space = await this.prisma.space.findUnique({
          where: { slug: spaceSlug },
          select: { id: true },
        });
        spaceId = space?.id;
      }
      if (!spaceId) return;

      const subs = await this.prisma.slackChannelSubscription.findMany({
        where: { spaceId, eventTypes: { has: type } },
      });
      if (!subs.length) return;

      const page = await this.prisma.page.findUnique({
        where: { id: pageId },
        include: {
          author: { select: { name: true } },
          space: { select: { slug: true, name: true } },
        },
      });
      if (!page) return;

      const frontendUrl = this.getFrontendUrl();
      const pageUrl = `${frontendUrl}/spaces/${page.space?.slug || spaceSlug}/pages/${page.id}`;
      const verb =
        type === 'page.created'
          ? 'created'
          : type === 'page.updated'
            ? 'updated'
            : 'deleted';
      const authorName = page.author?.name || payload?.authorName || 'Someone';
      const text = `:memo: ${authorName} ${verb} *${page.title || 'Untitled'}* in *${page.space?.name || ''}*`;
      const blocks = [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: text },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `<${pageUrl}|Open in Wikso>` }],
        },
      ];

      await Promise.all(
        subs.map((sub) => this.postToChannel(sub.slackChannelId, blocks, text)),
      );
    } catch (err: any) {
      this.logger.warn(`onPageEvent(${type}) failed: ${err?.message || err}`);
    }
  }

  // ─── Dev helpers ───────────────────────────────────────

  // Throwing helper kept for controller reuse.
  requireSigningSecret(): string {
    const v = this.getSigningSecret();
    if (!v) throw new UnauthorizedException('SLACK_SIGNING_SECRET not configured');
    return v;
  }
}
