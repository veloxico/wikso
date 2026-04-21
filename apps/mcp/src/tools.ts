/**
 * MCP tool definitions + handlers for Wikso.
 *
 * Each tool entry has:
 *   - name: stable identifier that appears to the LLM
 *   - description: short, intent-focused text so the model picks the right tool
 *   - schema: a zod schema defining the input shape
 *   - handler: async function that takes validated input + WiksoClient and
 *              returns a string (rendered into a single text content block)
 *
 * Output is formatted for LLM legibility: short headers, compact JSON for
 * raw fields, and a helpful fallback summary for every tool.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { WiksoClient, WiksoApiError } from './api-client.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: unknown, client: WiksoClient) => Promise<string>;
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Render a title/content JSON tiptap doc to a readable text excerpt.
 * Wikso stores content as tiptap JSON. We walk the tree and pull out text
 * nodes — this is best-effort, not a full renderer.
 */
function extractText(node: any, depth = 0): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map((n) => extractText(n, depth)).join('');
  if (typeof node !== 'object') return '';

  let out = '';
  if (node.type === 'text' && typeof node.text === 'string') out += node.text;
  if (Array.isArray(node.content)) {
    const inner = node.content.map((c: any) => extractText(c, depth + 1)).join('');
    // Add line breaks after block nodes so output is readable
    const blockTypes = new Set([
      'paragraph',
      'heading',
      'bulletList',
      'orderedList',
      'listItem',
      'blockquote',
      'codeBlock',
    ]);
    if (blockTypes.has(node.type)) out += inner + '\n';
    else out += inner;
  }
  return out;
}

//
// ── search_pages ────────────────────────────────────────────────────────────
//
const searchPagesSchema = z.object({
  query: z.string().min(1).describe('Search query text'),
  spaceId: z
    .string()
    .uuid()
    .optional()
    .describe('Optional space UUID to restrict results to a single space'),
  authorId: z
    .string()
    .uuid()
    .optional()
    .describe('Optional author UUID to filter to a single author'),
  tags: z.string().optional().describe('Optional comma-separated tag filter'),
});

const searchPagesTool: ToolDefinition = {
  name: 'search_pages',
  description:
    'Full-text search for wiki pages across all spaces the authenticated user can access. Returns matching pages with id, title, space, and a snippet. Use this as the first tool when the user asks "find", "search", or refers to a page by topic rather than exact id.',
  inputSchema: zodToJsonSchema(searchPagesSchema) as Record<string, unknown>,
  handler: async (raw, client) => {
    const input = searchPagesSchema.parse(raw);
    const res: any = await client.get('/search', {
      q: input.query,
      spaceId: input.spaceId,
      authorId: input.authorId,
      tags: input.tags,
    });
    const hits: any[] = Array.isArray(res?.hits) ? res.hits : [];
    if (hits.length === 0) {
      return `No pages matched "${input.query}".`;
    }
    const lines = hits.map((h: any, i: number) => {
      const title = h.title ?? '(untitled)';
      const space = h.spaceName || h.spaceSlug || h.spaceId || '?';
      return `${i + 1}. ${title}\n   id: ${h.id}\n   space: ${space} (slug: ${h.spaceSlug ?? '?'})\n   status: ${h.status ?? '?'}`;
    });
    return `Found ${hits.length} page(s) matching "${input.query}":\n\n${lines.join('\n\n')}`;
  },
};

//
// ── read_page ───────────────────────────────────────────────────────────────
//
const readPageSchema = z.object({
  spaceSlug: z
    .string()
    .min(1)
    .describe('Slug of the space containing the page (e.g. "engineering")'),
  pageId: z.string().uuid().describe('UUID of the page to read'),
});

const readPageTool: ToolDefinition = {
  name: 'read_page',
  description:
    'Fetch a single wiki page by id, including its title, metadata, and body text. Requires the space slug (the short identifier in the URL) and the page UUID. Use after search_pages or list_pages_in_space to inspect a specific page.',
  inputSchema: zodToJsonSchema(readPageSchema) as Record<string, unknown>,
  handler: async (raw, client) => {
    const input = readPageSchema.parse(raw);
    const page: any = await client.get(
      `/spaces/${encodeURIComponent(input.spaceSlug)}/pages/${encodeURIComponent(input.pageId)}`,
    );
    const text = extractText(page.contentJson).trim() || '(page has no body yet)';
    return (
      `Title: ${page.title ?? '(untitled)'}\n` +
      `ID: ${page.id}\n` +
      `Status: ${page.status ?? '?'}\n` +
      `Author: ${page.authorId ?? '?'}\n` +
      `Updated: ${page.updatedAt ?? '?'}\n` +
      `---\n${text}`
    );
  },
};

//
// ── list_spaces ─────────────────────────────────────────────────────────────
//
const listSpacesSchema = z.object({});

const listSpacesTool: ToolDefinition = {
  name: 'list_spaces',
  description:
    'List all wiki spaces the authenticated user can access. Returns id, slug, name, and type (PUBLIC/PRIVATE) for each. Use this first when you do not know which space a user is referring to, or to find the slug needed for other tools.',
  inputSchema: zodToJsonSchema(listSpacesSchema) as Record<string, unknown>,
  handler: async (_raw, client) => {
    const spaces: any = await client.get('/spaces');
    const list: any[] = Array.isArray(spaces) ? spaces : (spaces?.data ?? []);
    if (list.length === 0) return 'No spaces accessible with the current token.';
    const lines = list.map(
      (s: any, i: number) =>
        `${i + 1}. ${s.name ?? s.slug}\n   slug: ${s.slug}\n   id: ${s.id}\n   type: ${s.type ?? '?'}`,
    );
    return `Accessible spaces (${list.length}):\n\n${lines.join('\n\n')}`;
  },
};

//
// ── list_pages_in_space ─────────────────────────────────────────────────────
//
const listPagesSchema = z.object({
  spaceSlug: z.string().min(1).describe('Slug of the space to list pages for'),
});

const listPagesTool: ToolDefinition = {
  name: 'list_pages_in_space',
  description:
    'List the full page tree for a single space. Returns a hierarchical structure of pages with their titles, ids, and parent/child relationships. Use this to browse the contents of a space when the user asks what is in it.',
  inputSchema: zodToJsonSchema(listPagesSchema) as Record<string, unknown>,
  handler: async (raw, client) => {
    const input = listPagesSchema.parse(raw);
    const tree: any = await client.get(
      `/spaces/${encodeURIComponent(input.spaceSlug)}/pages`,
    );
    const list: any[] = Array.isArray(tree) ? tree : [];
    if (list.length === 0) {
      return `Space "${input.spaceSlug}" has no pages.`;
    }

    const render = (nodes: any[], indent: number): string[] => {
      const out: string[] = [];
      for (const n of nodes) {
        const prefix = '  '.repeat(indent) + '- ';
        out.push(`${prefix}${n.title ?? '(untitled)'}  [${n.id}]`);
        if (Array.isArray(n.children) && n.children.length > 0) {
          out.push(...render(n.children, indent + 1));
        }
      }
      return out;
    };

    const rendered = render(list, 0).join('\n');
    return `Page tree for space "${input.spaceSlug}":\n\n${rendered}`;
  },
};

//
// ── create_page ─────────────────────────────────────────────────────────────
//
const createPageSchema = z.object({
  spaceSlug: z.string().min(1).describe('Slug of the space to create the page in'),
  title: z.string().min(1).max(500).describe('Title of the new page'),
  parentId: z
    .string()
    .uuid()
    .optional()
    .describe('Optional UUID of a parent page (creates this page as its child)'),
  markdown: z
    .string()
    .optional()
    .describe(
      'Optional plain-text / markdown body. Will be wrapped into a minimal tiptap document with paragraphs split on blank lines.',
    ),
  contentJson: z
    .record(z.unknown())
    .optional()
    .describe(
      'Optional raw tiptap ProseMirror JSON document. Takes precedence over `markdown` if both are provided.',
    ),
  status: z
    .enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    .optional()
    .describe('Page status — defaults to DRAFT'),
});

/** Convert a plain-text body into minimal tiptap JSON. */
function markdownToTiptap(text: string): Record<string, unknown> {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.length > 0);
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  };
}

const createPageTool: ToolDefinition = {
  name: 'create_page',
  description:
    'Create a new wiki page inside a given space. Requires the space slug and a title. Optionally accepts a parent page id (to nest under another page), a plain-text/markdown body (which will be converted into a tiptap document), or a raw tiptap JSON document. Use this when the user asks to "create", "add", or "draft" a new page.',
  inputSchema: zodToJsonSchema(createPageSchema) as Record<string, unknown>,
  handler: async (raw, client) => {
    const input = createPageSchema.parse(raw);
    const content =
      input.contentJson ??
      (input.markdown ? markdownToTiptap(input.markdown) : undefined);
    const body: Record<string, unknown> = {
      title: input.title,
    };
    if (content !== undefined) body.contentJson = content;
    if (input.parentId) body.parentId = input.parentId;
    if (input.status) body.status = input.status;

    const page: any = await client.post(
      `/spaces/${encodeURIComponent(input.spaceSlug)}/pages`,
      body,
    );
    return (
      `Created page.\n` +
      `Title: ${page.title ?? input.title}\n` +
      `ID: ${page.id}\n` +
      `Space: ${input.spaceSlug}\n` +
      `Status: ${page.status ?? '?'}`
    );
  },
};

//
// ── update_page ─────────────────────────────────────────────────────────────
//
const updatePageSchema = z.object({
  spaceSlug: z.string().min(1).describe('Slug of the space the page lives in'),
  pageId: z.string().uuid().describe('UUID of the page to update'),
  title: z.string().min(1).max(500).optional().describe('New title'),
  markdown: z
    .string()
    .optional()
    .describe(
      'Optional plain-text / markdown body to replace the page content. Converted to a minimal tiptap document.',
    ),
  contentJson: z
    .record(z.unknown())
    .optional()
    .describe('Optional raw tiptap JSON document. Takes precedence over `markdown`.'),
  status: z
    .enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    .optional()
    .describe('New status value'),
});

const updatePageTool: ToolDefinition = {
  name: 'update_page',
  description:
    'Update an existing wiki page — change its title, body, and/or status. Any field omitted is left unchanged. Use this when the user asks to "edit", "rename", "republish", or "append to" an existing page. For body edits you can supply plain-text/markdown or raw tiptap JSON.',
  inputSchema: zodToJsonSchema(updatePageSchema) as Record<string, unknown>,
  handler: async (raw, client) => {
    const input = updatePageSchema.parse(raw);
    const content =
      input.contentJson ??
      (input.markdown ? markdownToTiptap(input.markdown) : undefined);
    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body.title = input.title;
    if (content !== undefined) body.contentJson = content;
    if (input.status !== undefined) body.status = input.status;
    if (Object.keys(body).length === 0) {
      return 'No update fields provided — nothing to do.';
    }

    const page: any = await client.patch(
      `/spaces/${encodeURIComponent(input.spaceSlug)}/pages/${encodeURIComponent(input.pageId)}`,
      body,
    );
    return (
      `Updated page.\n` +
      `Title: ${page.title ?? '?'}\n` +
      `ID: ${page.id ?? input.pageId}\n` +
      `Status: ${page.status ?? '?'}\n` +
      `Updated: ${page.updatedAt ?? '(just now)'}`
    );
  },
};

export const tools: ToolDefinition[] = [
  searchPagesTool,
  readPageTool,
  listSpacesTool,
  listPagesTool,
  createPageTool,
  updatePageTool,
];

/**
 * Dispatch by tool name. Catches WiksoApiError and returns a formatted
 * error string so the MCP layer can surface it via `isError: true`.
 */
export async function dispatchTool(
  name: string,
  input: unknown,
  client: WiksoClient,
): Promise<{ text: string; isError: boolean }> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { text: `Unknown tool: ${name}`, isError: true };
  }
  try {
    const text = await tool.handler(input, client);
    return { text, isError: false };
  } catch (err: any) {
    if (err instanceof WiksoApiError) {
      return {
        text: `API error (${err.status}): ${err.message}\n\nResponse body:\n${formatJson(err.body)}`,
        isError: true,
      };
    }
    if (err?.name === 'ZodError') {
      return {
        text: `Invalid input for ${name}: ${formatJson(err.errors ?? err.issues ?? err.message)}`,
        isError: true,
      };
    }
    return { text: `Error running ${name}: ${err?.message ?? String(err)}`, isError: true };
  }
}
