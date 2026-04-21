import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderRegistry } from './providers/ai-provider.registry';
import type { AiChatMessage } from './providers/ai-provider.interface';

export interface RetrievedSource {
  pageId: string;
  title: string;
  snippet: string;
  spaceSlug?: string;
  spaceName?: string;
  slug?: string;
}

const MAX_HISTORY_MESSAGES = 10;
const MAX_SOURCES = 5;
const CROP_LENGTH = 300;

/**
 * Prompt template used by the ask-your-wiki assistant.
 *
 * The assistant is instructed to answer ONLY from the retrieved excerpts and
 * to cite sources using [page:<uuid>] markers, which the frontend parses into
 * clickable chips.
 */
export const SYSTEM_PROMPT = `You are a helpful assistant for a wiki. Answer the user's question based ONLY on the wiki excerpts provided below. Cite sources inline using the format [page:<uuid>] where <uuid> is the page id of the excerpt you drew from. If the answer is not contained in the excerpts, say so honestly — do not invent information.`;

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly meili: MeiliSearch;
  private readonly indexName = 'pages';

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: AiProviderRegistry,
  ) {
    this.meili = new MeiliSearch({
      host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
      apiKey: process.env.MEILISEARCH_API_KEY || 'masterKey',
    });
  }

  // ---------------------------------------------------------------------------
  // Conversation CRUD
  // ---------------------------------------------------------------------------

  async listConversations(userId: string, skip = 0, take = 20) {
    const [data, total] = await Promise.all([
      this.prisma.aiConversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.aiConversation.count({ where: { userId } }),
    ]);
    return { data, total, skip, take };
  }

  async createConversation(userId: string, title?: string) {
    return this.prisma.aiConversation.create({
      data: { userId, title: title || 'New conversation' },
    });
  }

  async getConversation(conversationId: string, userId: string) {
    const convo = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!convo) throw new NotFoundException('Conversation not found');
    if (convo.userId !== userId) throw new ForbiddenException('Not your conversation');
    return convo;
  }

  async deleteConversation(conversationId: string, userId: string) {
    const convo = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });
    if (!convo) throw new NotFoundException('Conversation not found');
    if (convo.userId !== userId) throw new ForbiddenException('Not your conversation');
    await this.prisma.aiConversation.delete({ where: { id: conversationId } });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Retrieval
  // ---------------------------------------------------------------------------

  /**
   * Determine the set of space ids the user may read. A space is accessible if
   * it's PUBLIC, owned by the user, or explicitly shared with the user.
   */
  private async getAccessibleSpaceIds(userId: string): Promise<string[]> {
    const spaces = await this.prisma.space.findMany({
      where: {
        OR: [
          { type: 'PUBLIC' },
          { ownerId: userId },
          { permissions: { some: { userId } } },
          {
            permissions: {
              some: {
                group: { members: { some: { userId } } },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    return spaces.map((s) => s.id);
  }

  /**
   * Retrieve the top-N most relevant page excerpts for a natural-language query.
   * Filters on spaces the user can access.
   */
  async retrieveContext(userId: string, query: string): Promise<RetrievedSource[]> {
    const accessibleIds = await this.getAccessibleSpaceIds(userId);
    if (accessibleIds.length === 0) return [];

    // Meilisearch filter injection is prevented by UUID validation of ids.
    const uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeIds = accessibleIds.filter((id) => uuidRx.test(id));
    const filter = safeIds.length
      ? `spaceId IN [${safeIds.map((id) => `"${id}"`).join(', ')}]`
      : undefined;

    try {
      const index = this.meili.index(this.indexName);
      const results = await index.search(query.substring(0, 500), {
        filter,
        limit: MAX_SOURCES,
        attributesToCrop: ['content'],
        cropLength: CROP_LENGTH,
        attributesToHighlight: ['content', 'title'],
      });
      return results.hits.map((h: any) => ({
        pageId: h.id,
        title: h.title,
        snippet: this.stripHighlightTags(
          h._formatted?.content || this.snippetFromContent(h.content),
        ),
        spaceSlug: h.spaceSlug,
        spaceName: h.spaceName,
        slug: h.slug,
      }));
    } catch (err: any) {
      this.logger.warn(`Meilisearch retrieval failed: ${err?.message || err}`);
      return [];
    }
  }

  private stripHighlightTags(text: string): string {
    return (text || '').replace(/<\/?em>/g, '').substring(0, CROP_LENGTH);
  }

  private snippetFromContent(content: string): string {
    if (!content) return '';
    // Strip JSON structure markers to make raw ProseMirror JSON more readable.
    return content
      .replace(/[{}\[\]"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, CROP_LENGTH);
  }

  // ---------------------------------------------------------------------------
  // Streaming answer
  // ---------------------------------------------------------------------------

  /**
   * Persists the user question, retrieves context, builds the prompt and
   * streams back the assistant's answer. The assistant response is persisted
   * once streaming completes.
   */
  async streamAnswer(
    conversationId: string,
    userId: string,
    message: string,
  ): Promise<ReadableStream<Uint8Array>> {
    const convo = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true, title: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!convo) throw new NotFoundException('Conversation not found');
    if (convo.userId !== userId) throw new ForbiddenException('Not your conversation');

    const provider = this.providers.getActive();
    if (!provider) {
      throw new ServiceUnavailableException(
        'No AI provider is configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY or OLLAMA_HOST.',
      );
    }

    // Persist user message synchronously so it shows in history even if the
    // stream is aborted.
    await this.prisma.aiMessage.create({
      data: { conversationId, role: 'user', content: message },
    });

    const sources = await this.retrieveContext(userId, message);

    const history = convo.messages.slice(-MAX_HISTORY_MESSAGES).map<AiChatMessage>((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const contextBlock = sources.length
      ? sources
          .map(
            (s, i) =>
              `Excerpt ${i + 1} — ${s.title} [page:${s.pageId}]\n${s.snippet || '(no snippet)'}`,
          )
          .join('\n\n')
      : '(no matching wiki pages were found)';

    const prompt: AiChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'system',
        content: `Wiki excerpts:\n\n${contextBlock}`,
      },
      ...history,
      { role: 'user', content: message },
    ];

    // Fire-and-consume: tee the provider stream — one branch goes to the
    // client, the other collects the full text so we can persist it.
    let upstream: ReadableStream<Uint8Array>;
    try {
      upstream = await provider.chat({ messages: prompt, stream: true });
    } catch (err: any) {
      this.logger.error(`Provider chat failed: ${err?.message || err}`);
      throw new ServiceUnavailableException('AI provider request failed');
    }

    const [forClient, forPersist] = upstream.tee();

    // Persist assistant message once streaming finishes.
    this.collectAndPersist(conversationId, forPersist, sources).catch((err) => {
      this.logger.warn(`Failed to persist assistant message: ${err?.message || err}`);
    });

    // Update conversation title from the first user message if still default.
    if (convo.title === 'New conversation' && message.trim().length > 0) {
      const newTitle = message.trim().slice(0, 80);
      await this.prisma.aiConversation
        .update({ where: { id: conversationId }, data: { title: newTitle } })
        .catch(() => {});
    }

    return forClient;
  }

  /**
   * Drains a SSE stream, reconstructs the assistant text, and persists it.
   */
  private async collectAndPersist(
    conversationId: string,
    stream: ReadableStream<Uint8Array>,
    sources: RetrievedSource[],
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assembled = '';

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const ev of events) {
          for (const line of ev.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (typeof parsed?.delta === 'string') assembled += parsed.delta;
            } catch {
              // Ignore
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!assembled.trim()) return;

    await this.prisma.aiMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: assembled,
        sources: sources as unknown as Prisma.InputJsonValue,
      },
    });

    // Bump conversation updatedAt so the list orders correctly.
    await this.prisma.aiConversation
      .update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
      .catch(() => {});
  }
}
