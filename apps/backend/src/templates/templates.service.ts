import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, OnApplicationBootstrap } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

interface CurrentUserCtx {
  id: string;
  role?: GlobalRole | string;
}

@Injectable()
export class TemplatesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Build a Prisma `where` clause that returns only templates the caller is
   * allowed to see: global defaults, plus templates belonging to spaces the
   * caller can read (owner, direct permission, or group permission, or PUBLIC).
   * Global ADMINs bypass and see everything.
   */
  private accessibleTemplatesWhere(user: CurrentUserCtx) {
    if (user.role === GlobalRole.ADMIN) {
      return {};
    }
    return {
      OR: [
        { isDefault: true, spaceId: null },
        { space: { type: 'PUBLIC' as const } },
        { space: { ownerId: user.id } },
        { space: { permissions: { some: { userId: user.id } } } },
        {
          space: {
            permissions: {
              some: { group: { members: { some: { userId: user.id } } } },
            },
          },
        },
      ],
    };
  }

  /**
   * Verify caller can read templates scoped to `spaceId`. Throws 403 otherwise.
   * Global ADMINs bypass.
   */
  private async assertSpaceReadable(spaceId: string, user: CurrentUserCtx) {
    if (user.role === GlobalRole.ADMIN) return;
    const space = await this.prisma.space.findFirst({
      where: {
        id: spaceId,
        OR: [
          { type: 'PUBLIC' },
          { ownerId: user.id },
          { permissions: { some: { userId: user.id } } },
          { permissions: { some: { group: { members: { some: { userId: user.id } } } } } },
        ],
      },
      select: { id: true },
    });
    if (!space) {
      throw new ForbiddenException('You do not have access to this space');
    }
  }

  async onApplicationBootstrap() {
    // Skip during setup mode — Prisma isn't connected to a real DB.
    // Bootstrap fires again after the container restarts with the configured URL.
    if (!this.prisma.isReady) {
      this.logger.warn(
        'Skipping template seed — database not configured (setup mode)',
      );
      return;
    }

    try {
      await this.seedDefaults();
    } catch (err) {
      this.logger.error(
        `Template seed failed: ${(err as Error).message}`,
      );
      // Don't throw — failing to seed templates shouldn't crash the app
    }
  }

  async findAll(user: CurrentUserCtx, spaceId?: string) {
    // If caller asks for a specific space, verify they can read it.
    if (spaceId) {
      await this.assertSpaceReadable(spaceId, user);
      return this.prisma.pageTemplate.findMany({
        where: {
          OR: [{ isDefault: true, spaceId: null }, { spaceId }],
        },
        orderBy: [{ isDefault: 'desc' }, { title: 'asc' }],
        include: {
          creator: { select: { id: true, name: true, avatarUrl: true } },
          space: { select: { id: true, name: true, slug: true } },
        },
      });
    }

    // No spaceId — return defaults + templates the caller can reach.
    return this.prisma.pageTemplate.findMany({
      where: this.accessibleTemplatesWhere(user),
      orderBy: [{ isDefault: 'desc' }, { title: 'asc' }],
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        space: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findById(id: string, user: CurrentUserCtx) {
    const template = await this.prisma.pageTemplate.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        space: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!template) throw new NotFoundException('Template not found');

    // Defaults are open to any authenticated user; space-scoped ones require
    // membership (global admins bypass).
    if (template.spaceId) {
      await this.assertSpaceReadable(template.spaceId, user);
    }
    return template;
  }

  async create(dto: CreateTemplateDto, userId: string) {
    // Validate the space exists before attaching — a non-existent spaceId
    // would silently produce an orphan (or FK-fail later depending on DB).
    if (dto.spaceId) {
      const space = await this.prisma.space.findUnique({
        where: { id: dto.spaceId },
        select: { id: true },
      });
      if (!space) {
        throw new BadRequestException('Space not found');
      }
    }

    return this.prisma.pageTemplate.create({
      data: {
        title: dto.title,
        description: dto.description,
        contentJson: dto.contentJson,
        category: dto.category || 'General',
        icon: dto.icon,
        spaceId: dto.spaceId || null,
        creatorId: userId,
      },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        space: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const existing = await this.prisma.pageTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Template not found');

    // If reattaching to a different space, validate it exists.
    if (dto.spaceId !== undefined && dto.spaceId !== null && dto.spaceId !== existing.spaceId) {
      const space = await this.prisma.space.findUnique({
        where: { id: dto.spaceId },
        select: { id: true },
      });
      if (!space) {
        throw new BadRequestException('Space not found');
      }
    }

    return this.prisma.pageTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.contentJson !== undefined && { contentJson: dto.contentJson as any }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.spaceId !== undefined && { spaceId: dto.spaceId }),
      },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        space: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.pageTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Template not found');

    await this.prisma.pageTemplate.delete({ where: { id } });
    return { message: 'Template deleted' };
  }

  /**
   * Seed default templates. Idempotent — only creates templates that don't
   * already exist (matched by title + isDefault: true + spaceId: null). Never
   * overwrites or deletes anything, so admin edits to default templates persist
   * across restarts.
   *
   * Multi-instance safe: wraps everything in a Postgres transaction and takes
   * a transaction-scoped advisory lock (`pg_try_advisory_xact_lock`) so two
   * backends booting concurrently don't race and create duplicates.
   *
   * Why transaction-scoped (xact) instead of session-scoped: the previous
   * `pg_try_advisory_lock` + `pg_advisory_unlock` pair leaks the lock if the
   * connection dies mid-seed (pod OOM, restart, network blip), AND in a
   * connection pool the unlock can run on a *different* connection than the
   * one that took the lock — leaving the original session's lock held until
   * Postgres reaps the connection. `pg_try_advisory_xact_lock` is released
   * automatically by Postgres on COMMIT or ROLLBACK, so it can never leak.
   *
   * The lock key (`0x57494B53`, ASCII "WIKS") is arbitrary but stable across
   * boots.
   */
  async seedDefaults() {
    const LOCK_KEY = 0x57494b53; // "WIKS" — module-unique, fits in int4

    await this.prisma.$transaction(async (tx) => {
      // pg_try_advisory_xact_lock returns true if we got the lock, false if
      // another tx holds it. Skip silently on contention — the winner does
      // the work, our COMMIT/ROLLBACK frees the lock either way.
      const lockResult = await tx.$queryRaw<Array<{ pg_try_advisory_xact_lock: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${LOCK_KEY})
      `;
      const gotLock = lockResult[0]?.pg_try_advisory_xact_lock === true;
      if (!gotLock) {
        this.logger.log('Another instance is seeding templates — skipping');
        return;
      }

      const defaults = this.getDefaultTemplates();
      let created = 0;
      let skipped = 0;

      for (const template of defaults) {
        // IMPORTANT: use `tx`, not `this.prisma`, so these queries inherit the
        // advisory lock. A bare prisma.* call would borrow a different
        // connection and bypass the lock entirely.
        const existing = await tx.pageTemplate.findFirst({
          where: {
            title: template.title,
            isDefault: true,
            spaceId: null,
          },
          select: { id: true },
        });

        if (existing) {
          skipped += 1;
          continue;
        }

        await tx.pageTemplate.create({
          data: {
            ...template,
            isDefault: true,
            spaceId: null,
          },
        });
        created += 1;
      }

      if (created > 0) {
        this.logger.log(
          `Seeded ${created} default template(s) (${skipped} already present)`,
        );
      } else {
        this.logger.log(
          `Default templates already present (${skipped}), nothing to seed`,
        );
      }
    }, {
      // Seeding 6 templates with 12 small queries comfortably fits in 30s.
      // Default Prisma tx timeout is 5s which would abort under contention.
      timeout: 30_000,
    });
  }

  /**
   * Default template definitions. Mirrors the 6 templates rendered on the
   * frontend (apps/frontend/src/components/features/PageTemplates.tsx) so that
   * removing the hardcoded frontend list doesn't lose any content.
   *
   * Each template uses italic-marked text inside list items / paragraphs as
   * inline placeholders ("write the goal here") so users see what to put
   * where. They overwrite the hint when they start typing.
   */
  private getDefaultTemplates(): Array<{
    title: string;
    description: string;
    icon: string | null;
    category: string;
    contentJson: any;
  }> {
    // ── TipTap node helpers (keep contentJson readable) ───────────────────
    const t = (text: string): { type: 'text'; text: string } => ({ type: 'text', text });
    const i = (
      text: string,
    ): { type: 'text'; text: string; marks: Array<{ type: string }> } => ({
      type: 'text',
      text,
      marks: [{ type: 'italic' }],
    });
    const b = (
      text: string,
    ): { type: 'text'; text: string; marks: Array<{ type: string }> } => ({
      type: 'text',
      text,
      marks: [{ type: 'bold' }],
    });
    const h1 = (text: string) => ({
      type: 'heading',
      attrs: { level: 1 },
      content: [t(text)],
    });
    const h2 = (text: string) => ({
      type: 'heading',
      attrs: { level: 2 },
      content: [t(text)],
    });
    const p = (...nodes: any[]) => ({ type: 'paragraph', content: nodes });
    const li = (...nodes: any[]) => ({
      type: 'list_item',
      content: [p(...nodes)],
    });
    const ul = (...items: any[]) => ({ type: 'bullet_list', content: items });
    const ol = (...items: any[]) => ({ type: 'ordered_list', content: items });
    const task = (...items: any[]) => ({ type: 'task_list', content: items });
    const taskItem = (...nodes: any[]) => ({
      type: 'task_item',
      attrs: { checked: false },
      content: [p(...nodes)],
    });
    const th = (text: string) => ({
      type: 'table_header',
      content: [p(t(text))],
    });
    const td = (...nodes: any[]) => ({
      type: 'table_cell',
      content: [p(...nodes)],
    });
    const tr = (...cells: any[]) => ({ type: 'table_row', content: cells });
    const table = (...rows: any[]) => ({ type: 'table', content: rows });

    return [
      {
        title: 'Blank Page',
        description: 'Start from scratch with an empty page',
        icon: '📄',
        category: 'General',
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [] }],
        },
      },
      // ── Meeting Notes — chronological flow of an actual meeting ────────
      {
        title: 'Meeting Notes',
        description: 'Capture meeting details, attendees, and action items',
        icon: '📝',
        category: 'Team',
        contentJson: {
          type: 'doc',
          content: [
            h1('Meeting Title'),
            p(i('Date · Duration · Location or call link')),

            h2('Attendees'),
            ul(li(i('Name (role) — present / absent'))),

            h2('Agenda'),
            ol(
              li(i('Topic 1 — brief framing')),
              li(i('Topic 2 — brief framing')),
            ),

            h2('Discussion notes'),
            p(i('Key points raised, questions, context. Plain notes — not conclusions.')),

            h2('Decisions'),
            ul(li(i('What was decided and the rationale behind it'))),

            h2('Action items'),
            task(taskItem(i('Owner — task — due date'))),

            h2('Follow-up'),
            p(i('Next meeting · open questions · materials to circulate')),
          ],
        },
      },
      // ── Technical Spec — full design doc with rollout & alternatives ────
      {
        title: 'Technical Spec',
        description: 'Document technical architecture and design decisions',
        icon: '🛠',
        category: 'Documentation',
        contentJson: {
          type: 'doc',
          content: [
            h1('Technical Specification'),
            p(i('Author · Reviewers · Status (Draft / Review / Approved) · Date')),

            h2('Summary'),
            p(i('TL;DR — what this proposes in 2-3 sentences a stranger could understand.')),

            h2('Background'),
            p(i('Why now? What problem are we solving and what context does the reader need?')),

            h2('Goals'),
            ul(li(i('Concrete outcome the design must achieve'))),

            h2('Non-goals'),
            ul(li(i('What we are intentionally NOT doing — keeps scope honest'))),

            h2('Proposed design'),
            p(i('How the system works after this change. Diagrams, components, data flow.')),

            h2('Alternatives considered'),
            ul(li(i('Option — pros / cons / why rejected'))),

            h2('API & schema changes'),
            p(i('New endpoints, modified contracts, DB migrations, breaking changes.')),

            h2('Testing strategy'),
            ul(li(i('Unit / integration / e2e coverage plan, including edge cases'))),

            h2('Rollout & risks'),
            p(i('Feature flag · phased rollout · rollback plan · what could break')),

            h2('Open questions'),
            ul(li(i('Decision still needed before merging'))),
          ],
        },
      },
      // ── Onboarding Guide — actionable first-week playbook ───────────────
      {
        title: 'Onboarding Guide',
        description: 'Help new team members get started quickly',
        icon: '🚀',
        category: 'Team',
        contentJson: {
          type: 'doc',
          content: [
            h1('Welcome to the team!'),
            p(i('A short, warm intro from the team lead — what we do and why it matters.')),

            h2('Your first week'),
            ol(
              li(i('Day 1 — accounts, intros, environment setup')),
              li(i('Day 2-3 — codebase tour and first small PR')),
              li(i('Day 4-5 — pair on a real ticket end-to-end')),
            ),

            h2('Setup checklist'),
            task(
              taskItem(i('Get accounts (email, GitHub, Slack, password manager)')),
              taskItem(i('Install dev tools and run the app locally')),
              taskItem(i('Read CONTRIBUTING.md and the architecture overview')),
              taskItem(i('Schedule 1:1s with team members')),
            ),

            h2('Key resources'),
            table(
              tr(th('Resource'), th('Link'), th('When you need it')),
              tr(
                td(i('Main repo')),
                td(i('github.com/...')),
                td(i('Always')),
              ),
              tr(
                td(i('Design system')),
                td(i('figma.com/...')),
                td(i('Building UI')),
              ),
            ),

            h2('Who to talk to'),
            table(
              tr(th('Topic'), th('Person'), th('Where')),
              tr(
                td(i('HR / equipment')),
                td(i('Name')),
                td(i('Slack #hr')),
              ),
              tr(
                td(i('Codebase / architecture')),
                td(i('Name')),
                td(i('Slack #eng')),
              ),
            ),

            h2('FAQ'),
            p(i('Add the questions you wished someone had answered on day one.')),
          ],
        },
      },
      // ── Decision Record — full ADR with split positive/negative outcomes ─
      {
        title: 'Decision Record',
        description: 'Record decisions, their context, and consequences',
        icon: '🎯',
        category: 'Planning',
        contentJson: {
          type: 'doc',
          content: [
            h1('ADR-XXX: Decision Title'),
            p(
              b('Status: '),
              i('Proposed · Accepted · Deprecated · Superseded'),
              t('   ·   '),
              b('Date: '),
              i('YYYY-MM-DD'),
              t('   ·   '),
              b('Deciders: '),
              i('names'),
            ),

            h2('Context'),
            p(i('What problem are we solving? What forces are at play (technical, business, social)?')),

            h2('Decision drivers'),
            ul(li(i('Constraint or quality attribute that matters most'))),

            h2('Considered options'),
            ul(
              li(i('Option A — short summary')),
              li(i('Option B — short summary')),
              li(i('Option C — short summary')),
            ),

            h2('Decision'),
            p(i('We chose X because ... (one paragraph, no equivocation).')),

            h2('Consequences'),
            p(b('Positive')),
            ul(li(i('What gets better as a result'))),
            p(b('Negative')),
            ul(li(i('What we trade away or take on as new debt'))),

            h2('Links'),
            ul(li(i('Related ADRs, tickets, prior art, supporting docs'))),
          ],
        },
      },
      // ── Retrospective — Start / Stop / Continue (different format from Meeting Notes) ─
      {
        title: 'Retrospective',
        description: 'Reflect on what went well and what could improve',
        icon: '🔄',
        category: 'Team',
        contentJson: {
          type: 'doc',
          content: [
            h1('Sprint Retrospective'),
            p(i('Sprint · Period · Facilitator · Participants')),

            h2('🟢 Start'),
            p(i('New behaviors or practices we should begin doing')),
            ul(li()),

            h2('🔴 Stop'),
            p(i('Things that are hurting us — drop them')),
            ul(li()),

            h2('🟡 Continue'),
            p(i('What worked well — keep doing it')),
            ul(li()),

            h2('Action items'),
            task(taskItem(i('Owner — what — by when'))),

            h2('Team sentiment'),
            p(i('How does the team feel? (1-5 mood, anonymous votes, theme of the sprint)')),
          ],
        },
      },
    ];
  }
}
