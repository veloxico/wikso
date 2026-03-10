import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { parseConfluenceXml, ParsedConfluenceData } from './confluence-xml-parser';
import {
  convertConfluenceToTipTap,
  fixAttachmentReferences,
  fixPageReferences,
} from './confluence-converter';

// ─── Types ────────────────────────────────────────────────

export interface ImportProgress {
  phase: 'uploading' | 'extracting' | 'parsing' | 'spaces' | 'pages' | 'attachments' | 'fixing-refs' | 'comments' | 'tags' | 'indexing' | 'done' | 'error';
  percent: number;
  counts: {
    spaces: number;
    pages: number;
    attachments: number;
    comments: number;
    tags: number;
  };
  errors: string[];
  message?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

// ─── Service ──────────────────────────────────────────────

@Injectable()
export class ImportService {
  private logger = new Logger(ImportService.name);
  private s3: S3Client;
  private bucket: string;

  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) {
    this.bucket = process.env.MINIO_BUCKET || process.env.S3_BUCKET || 'wikso-uploads';

    const useSsl = process.env.MINIO_USE_SSL === 'true' || process.env.S3_USE_SSL === 'true';
    const rawEndpoint = process.env.MINIO_ENDPOINT || process.env.S3_ENDPOINT;
    let host = 'localhost';
    let port = process.env.MINIO_PORT || process.env.S3_PORT || '9000';

    if (rawEndpoint) {
      try {
        const url = new URL(rawEndpoint.startsWith('http') ? rawEndpoint : `http://${rawEndpoint}`);
        host = url.hostname;
        port = url.port || port;
      } catch {
        host = rawEndpoint.replace(/^https?:\/\//, '').split(':')[0] || host;
      }
    }

    this.s3 = new S3Client({
      endpoint: `http${useSsl ? 's' : ''}://${host}:${port}`,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || process.env.S3_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: true,
    });
  }

  /**
   * Main import orchestration method. Called from the BullMQ processor.
   */
  async processImport(
    zipPath: string,
    adminUserId: string,
    onProgress: (progress: ImportProgress) => void,
  ): Promise<ImportProgress> {
    const progress: ImportProgress = {
      phase: 'extracting',
      percent: 0,
      counts: { spaces: 0, pages: 0, attachments: 0, comments: 0, tags: 0 },
      errors: [],
    };

    let tmpDir = '';

    try {
      // Ensure S3 bucket exists
      try {
        await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      } catch {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      }

      // ─── Step 1: Extract ZIP ──────────────────────
      progress.phase = 'extracting';
      progress.message = 'Extracting ZIP archive...';
      onProgress(progress);

      tmpDir = path.join(os.tmpdir(), `wikso-import-${uuid()}`);
      fs.mkdirSync(tmpDir, { recursive: true });

      execSync(`unzip -o -q "${zipPath}" -d "${tmpDir}"`, {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 600_000, // 10 min
      });

      progress.percent = 5;
      onProgress(progress);

      // ─── Step 2: Parse entities.xml ───────────────
      progress.phase = 'parsing';
      progress.message = 'Parsing Confluence entities...';
      onProgress(progress);

      const xmlPath = path.join(tmpDir, 'entities.xml');
      if (!fs.existsSync(xmlPath)) {
        throw new Error('entities.xml not found in the ZIP archive. Is this a valid Confluence export?');
      }

      const data = await parseConfluenceXml(xmlPath, (bytesRead, totalBytes) => {
        const pct = 5 + Math.floor((bytesRead / totalBytes) * 20); // 5% - 25%
        progress.percent = pct;
        onProgress(progress);
      });

      this.logger.log(
        `Parsed: ${data.spaces.size} spaces, ${data.pages.size} pages, ` +
        `${data.blogPosts.size} blogs, ${data.attachments.size} attachments, ` +
        `${data.comments.size} comments, ${data.labels.size} labels`,
      );

      progress.percent = 25;
      onProgress(progress);

      // ─── Step 3: Create Spaces ────────────────────
      progress.phase = 'spaces';
      progress.message = 'Creating spaces...';
      onProgress(progress);

      const spaceMapping = await this.createSpaces(data, adminUserId, progress);

      progress.percent = 30;
      onProgress(progress);

      // ─── Step 4: Create Pages (two-pass) ──────────
      progress.phase = 'pages';
      progress.message = 'Importing pages...';
      onProgress(progress);

      const { pageMapping, pageTitleToId } = await this.createPages(
        data,
        spaceMapping,
        adminUserId,
        progress,
        onProgress,
      );

      progress.percent = 60;
      onProgress(progress);

      // ─── Step 5: Upload Attachments ───────────────
      progress.phase = 'attachments';
      progress.message = 'Uploading attachments...';
      onProgress(progress);

      const attachmentMapping = await this.uploadAttachments(
        data,
        tmpDir,
        pageMapping,
        adminUserId,
        progress,
        onProgress,
      );

      progress.percent = 80;
      onProgress(progress);

      // ─── Step 6: Fix References ───────────────────
      progress.phase = 'fixing-refs';
      progress.message = 'Fixing image and link references...';
      onProgress(progress);

      await this.fixReferences(
        pageMapping,
        attachmentMapping,
        pageTitleToId,
        data,
        progress,
      );

      progress.percent = 85;
      onProgress(progress);

      // ─── Step 7: Create Comments ──────────────────
      progress.phase = 'comments';
      progress.message = 'Importing comments...';
      onProgress(progress);

      await this.createComments(data, pageMapping, adminUserId, progress);

      progress.percent = 90;
      onProgress(progress);

      // ─── Step 8: Create Tags ──────────────────────
      progress.phase = 'tags';
      progress.message = 'Importing tags...';
      onProgress(progress);

      await this.createTags(data, pageMapping, spaceMapping, progress);

      progress.percent = 92;
      onProgress(progress);

      // ─── Step 9: Reindex search ────────────────────
      progress.phase = 'indexing';
      progress.message = 'Building search index...';
      onProgress(progress);

      try {
        const { indexed } = await this.searchService.reindexAll();
        this.logger.log(`Search reindex after import: ${indexed} pages`);
      } catch (err: any) {
        this.logger.warn(`Search reindex failed: ${err.message}`);
        progress.errors.push(`Search reindex failed: ${err.message}`);
      }

      progress.percent = 98;
      onProgress(progress);

      // ─── Step 10: Done ─────────────────────────────
      progress.phase = 'done';
      progress.percent = 100;
      progress.message = 'Import completed successfully!';
      onProgress(progress);

      return progress;
    } catch (err: any) {
      this.logger.error(`Import failed: ${err.message}`, err.stack);
      progress.phase = 'error';
      progress.message = err.message;
      progress.errors.push(err.message);
      onProgress(progress);
      return progress;
    } finally {
      // Cleanup temp directory
      if (tmpDir && fs.existsSync(tmpDir)) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) {
          this.logger.warn(`Failed to cleanup temp dir: ${tmpDir}`);
        }
      }
      // Remove uploaded ZIP
      if (fs.existsSync(zipPath)) {
        try {
          fs.unlinkSync(zipPath);
        } catch (e) {
          this.logger.warn(`Failed to cleanup ZIP: ${zipPath}`);
        }
      }
    }
  }

  // ─── Create Spaces ─────────────────────────────────────

  private async createSpaces(
    data: ParsedConfluenceData,
    adminUserId: string,
    progress: ImportProgress,
  ): Promise<Map<string, string>> {
    const mapping = new Map<string, string>(); // cfSpaceId → wiksoSpaceId

    for (const [cfId, cfSpace] of data.spaces) {
      try {
        let slug = cfSpace.key.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        if (!slug) slug = `space-${cfId}`;

        const existing = await this.prisma.space.findUnique({ where: { slug } });

        if (existing) {
          mapping.set(cfId, existing.id);
          progress.counts.spaces++;
          continue;
        }

        const space = await this.prisma.space.create({
          data: {
            slug,
            name: cfSpace.name || cfSpace.key,
            description: cfSpace.description || null,
            type: cfSpace.spaceType === 'personal' ? 'PERSONAL' : 'PUBLIC',
            ownerId: adminUserId,
          },
        });

        mapping.set(cfId, space.id);
        progress.counts.spaces++;
      } catch (err: any) {
        this.logger.warn(`Failed to create space ${cfSpace.key}: ${err.message}`);
        progress.errors.push(`Space ${cfSpace.key}: ${err.message}`);
      }
    }

    return mapping;
  }

  // ─── Create Pages ──────────────────────────────────────

  private async createPages(
    data: ParsedConfluenceData,
    spaceMapping: Map<string, string>,
    adminUserId: string,
    progress: ImportProgress,
    onProgress: (progress: ImportProgress) => void,
  ): Promise<{
    pageMapping: Map<string, string>;
    pageTitleToId: Map<string, string>;
  }> {
    const pageMapping = new Map<string, string>(); // cfPageId → wiksoPageId
    const pageTitleToId = new Map<string, string>(); // pageTitle → wiksoPageId

    // Combine pages and blog posts
    const allPages: Array<{
      cfId: string;
      title: string;
      spaceId?: string;
      parentId?: string;
      position: number;
      createdDate?: string;
      originalVersionId?: string;
    }> = [];

    for (const [cfId, page] of data.pages) {
      allPages.push({
        cfId,
        title: page.title,
        spaceId: page.spaceId,
        parentId: page.parentId,
        position: page.position,
        createdDate: page.createdDate,
        originalVersionId: page.originalVersionId,
      });
    }

    for (const [cfId, blog] of data.blogPosts) {
      allPages.push({
        cfId,
        title: blog.title,
        spaceId: blog.spaceId,
        position: 0,
        createdDate: blog.createdDate,
      });
    }

    const totalPages = allPages.length;
    let processed = 0;

    // Pass 1: Create all pages without parentId
    for (const page of allPages) {
      try {
        const wiksoSpaceId = page.spaceId ? spaceMapping.get(page.spaceId) : null;
        if (!wiksoSpaceId) {
          // Try to find the space via parent chain
          const parentSpaceId = this.resolveSpaceViaParent(page, data, spaceMapping);
          if (!parentSpaceId) {
            progress.errors.push(`Page "${page.title}": no space found`);
            continue;
          }
          page.spaceId = parentSpaceId;
        }

        const spaceId = page.spaceId ? spaceMapping.get(page.spaceId) : null;
        if (!spaceId) continue;

        // Convert body content (try current page ID, then originalVersionId)
        const bodyByCfId = data.bodyContents.get(page.cfId);
        const bodyByOrig = page.originalVersionId ? data.bodyContents.get(page.originalVersionId) : null;
        const body = bodyByCfId || bodyByOrig;
        let contentJson: any = { type: 'doc', content: [{ type: 'paragraph' }] };

        if (body && body.body) {
          try {
            contentJson = convertConfluenceToTipTap(body.body);
          } catch (err: any) {
            this.logger.warn(`Failed to convert body for page "${page.title}": ${err.message}`);
            progress.errors.push(`Page "${page.title}" body conversion: ${err.message}`);
          }
        }

        // Debug: log body resolution for pages with suspiciously small content
        const jsonLen = JSON.stringify(contentJson).length;
        if (body && body.body.length > 1000 && jsonLen < 2000) {
          this.logger.warn(
            `Body resolution mismatch for "${page.title}" (cfId=${page.cfId}, origVer=${page.originalVersionId}): ` +
            `XHTML=${body.body.length} chars (bodyType=${body.bodyType}, bodyContentId=${body.bodyContentId}), ` +
            `JSON=${jsonLen} chars`,
          );
        }
        if (!body) {
          this.logger.debug(
            `No body found for "${page.title}" (cfId=${page.cfId}, origVer=${page.originalVersionId})`,
          );
        }

        const slug = slugify(page.title || 'untitled') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

        const created = await this.prisma.page.create({
          data: {
            spaceId,
            title: page.title || 'Untitled',
            slug,
            contentJson,
            status: 'PUBLISHED',
            authorId: adminUserId,
            position: page.position,
          },
        });

        pageMapping.set(page.cfId, created.id);
        // Also map originalVersionId so attachments/comments can find this page
        if (page.originalVersionId) {
          pageMapping.set(page.originalVersionId, created.id);
        }
        pageTitleToId.set(page.title, created.id);

        progress.counts.pages++;
        processed++;

        // Report progress every 100 pages
        if (processed % 100 === 0) {
          progress.percent = 30 + Math.floor((processed / totalPages) * 25); // 30% - 55%
          progress.message = `Importing pages... (${processed}/${totalPages})`;
          onProgress(progress);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to create page "${page.title}": ${err.message}`);
        progress.errors.push(`Page "${page.title}": ${err.message}`);
      }
    }

    // Pass 2: Set parentId for pages with parents
    for (const page of allPages) {
      if (!page.parentId) continue;

      const wiksoPageId = pageMapping.get(page.cfId);
      const wiksoParentId = pageMapping.get(page.parentId);

      if (wiksoPageId && wiksoParentId) {
        try {
          await this.prisma.page.update({
            where: { id: wiksoPageId },
            data: { parentId: wiksoParentId },
          });
        } catch (err: any) {
          this.logger.warn(`Failed to set parent for page "${page.title}": ${err.message}`);
        }
      }
    }

    return { pageMapping, pageTitleToId };
  }

  private resolveSpaceViaParent(
    page: { parentId?: string; spaceId?: string },
    data: ParsedConfluenceData,
    spaceMapping: Map<string, string>,
  ): string | null {
    const visited = new Set<string>();
    let current = page;

    while (current.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      const parent = data.pages.get(current.parentId);
      if (!parent) break;

      if (parent.spaceId && spaceMapping.has(parent.spaceId)) {
        return parent.spaceId;
      }
      current = parent;
    }

    return null;
  }

  // ─── Upload Attachments ────────────────────────────────

  private async uploadAttachments(
    data: ParsedConfluenceData,
    tmpDir: string,
    pageMapping: Map<string, string>,
    adminUserId: string,
    progress: ImportProgress,
    onProgress: (progress: ImportProgress) => void,
  ): Promise<Map<string, { wiksoId: string; filename: string }>> {
    const mapping = new Map<string, { wiksoId: string; filename: string }>();

    const totalAttachments = data.attachments.size;
    let processed = 0;

    for (const [cfId, att] of data.attachments) {
      try {
        const wiksoPageId = att.containerId ? pageMapping.get(att.containerId) : null;
        if (!wiksoPageId) continue;

        // Find the file in the extracted archive
        const version = att.version || 1;
        const attDir = path.join(tmpDir, 'attachments', att.containerId!, cfId);
        let filePath = path.join(attDir, String(version));

        if (!fs.existsSync(filePath)) {
          // Try without version — check all files in the directory
          if (fs.existsSync(attDir)) {
            const files = fs.readdirSync(attDir).sort((a, b) => parseInt(b) - parseInt(a));
            if (files.length > 0) {
              filePath = path.join(attDir, files[0]);
            } else {
              continue; // No attachment file found
            }
          } else {
            continue;
          }
        }

        const fileBuffer = fs.readFileSync(filePath);
        const rawFilename = att.title || `attachment-${cfId}`;
        // Sanitize filename: keep only safe characters, limit length to 200 chars
        const ext = rawFilename.includes('.') ? '.' + rawFilename.split('.').pop()!.replace(/[^a-zA-Z0-9]/g, '') : '';
        const baseName = rawFilename
          .replace(/\.[^.]+$/, '') // remove extension
          .replace(/[^\w\s.-]/g, '_') // replace unsafe chars with _
          .replace(/\s+/g, '_') // spaces to underscores
          .replace(/_+/g, '_') // collapse multiple underscores
          .substring(0, 200); // limit length
        const filename = (baseName + ext) || `attachment-${cfId}`;
        const storageKey = `${wiksoPageId}/${uuid()}-${filename}`;
        const mimeType = att.mediaType || 'application/octet-stream';

        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: storageKey,
            Body: fileBuffer,
            ContentType: mimeType,
          }),
        );

        const attachment = await this.prisma.attachment.create({
          data: {
            pageId: wiksoPageId,
            uploaderId: adminUserId,
            filename,
            mimeType,
            size: fileBuffer.length,
            storageKey,
          },
        });

        mapping.set(cfId, { wiksoId: attachment.id, filename });
        progress.counts.attachments++;
        processed++;

        if (processed % 50 === 0) {
          progress.percent = 60 + Math.floor((processed / totalAttachments) * 18); // 60% - 78%
          progress.message = `Uploading attachments... (${processed}/${totalAttachments})`;
          onProgress(progress);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to upload attachment ${att.title}: ${err.message}`);
        progress.errors.push(`Attachment ${att.title}: ${err.message}`);
      }
    }

    return mapping;
  }

  // ─── Fix References ────────────────────────────────────

  private async fixReferences(
    pageMapping: Map<string, string>,
    attachmentMapping: Map<string, { wiksoId: string; filename: string }>,
    pageTitleToId: Map<string, string>,
    data: ParsedConfluenceData,
    progress: ImportProgress,
  ) {
    // Build filename → attachment URL lookup grouped by Confluence page container
    const pageAttachments = new Map<string, Map<string, string>>(); // cfPageId → Map<filename, wiksoUrl>
    // Also build a global filename → URL map as fallback for cross-page image refs
    const globalAttachments = new Map<string, string>(); // filename → wiksoUrl (first-wins)

    for (const [cfAttId, att] of data.attachments) {
      if (!att.containerId) continue;
      const mapped = attachmentMapping.get(cfAttId);
      if (!mapped) continue;

      const url = `/api/v1/attachments/${mapped.wiksoId}/file`;

      if (!pageAttachments.has(att.containerId)) {
        pageAttachments.set(att.containerId, new Map());
      }
      pageAttachments.get(att.containerId)!.set(att.title, url);

      if (!globalAttachments.has(att.title)) {
        globalAttachments.set(att.title, url);
      }
    }

    // Group all Confluence IDs (currentCfId, originalVersionId) by wiksoPageId
    // so we process each Wikso page exactly once with merged attachment lookup
    const wiksoToConfluenceIds = new Map<string, string[]>(); // wiksoPageId → [cfPageIds]
    for (const [cfPageId, wiksoPageId] of pageMapping) {
      if (!wiksoToConfluenceIds.has(wiksoPageId)) {
        wiksoToConfluenceIds.set(wiksoPageId, []);
      }
      wiksoToConfluenceIds.get(wiksoPageId)!.push(cfPageId);
    }

    // Update each Wikso page's contentJson — process each page exactly once
    for (const [wiksoPageId, cfIds] of wiksoToConfluenceIds) {
      try {
        const page = await this.prisma.page.findUnique({
          where: { id: wiksoPageId },
          select: { contentJson: true },
        });

        if (!page || !page.contentJson) continue;

        let contentJson = page.contentJson as any;
        let modified = false;

        // Merge attachment lookups from all Confluence IDs for this page
        const mergedLookup = new Map<string, string>();
        for (const cfId of cfIds) {
          const lookup = pageAttachments.get(cfId);
          if (lookup) {
            for (const [filename, url] of lookup) {
              mergedLookup.set(filename, url);
            }
          }
        }

        // Fix attachment references — try merged lookup first, then global fallback
        contentJson = fixAttachmentReferences(contentJson, (filename) => {
          const url = mergedLookup.get(filename) || globalAttachments.get(filename);
          if (url) {
            modified = true;
            return url;
          }
          return null;
        });

        // Fix page link references
        contentJson = fixPageReferences(contentJson, (title) => {
          const targetId = pageTitleToId.get(title);
          if (targetId) {
            modified = true;
            return `/pages/${targetId}`;
          }
          return null;
        });

        if (modified) {
          await this.prisma.page.update({
            where: { id: wiksoPageId },
            data: { contentJson },
          });
        }
      } catch (err: any) {
        this.logger.warn(`Failed to fix refs for page ${wiksoPageId}: ${err.message}`);
      }
    }
  }

  // ─── Create Comments ───────────────────────────────────

  private async createComments(
    data: ParsedConfluenceData,
    pageMapping: Map<string, string>,
    adminUserId: string,
    progress: ImportProgress,
  ) {
    const commentMapping = new Map<string, string>(); // cfCommentId → wiksoCommentId

    // First pass: create all comments without parentId
    for (const [cfId, comment] of data.comments) {
      try {
        const wiksoPageId = comment.containerId ? pageMapping.get(comment.containerId) : null;
        if (!wiksoPageId) continue;

        const body = data.bodyContents.get(cfId);
        let content = '';
        if (body && body.body) {
          // Extract plain text from the comment HTML
          content = body.body.replace(/<[^>]+>/g, '').trim();
        }

        if (!content) content = '(imported comment)';

        const created = await this.prisma.comment.create({
          data: {
            pageId: wiksoPageId,
            authorId: adminUserId,
            content,
          },
        });

        commentMapping.set(cfId, created.id);
        progress.counts.comments++;
      } catch (err: any) {
        this.logger.warn(`Failed to create comment: ${err.message}`);
      }
    }

    // Second pass: set parentId for threaded comments
    for (const [cfId, comment] of data.comments) {
      if (!comment.parentId) continue;

      const wiksoCommentId = commentMapping.get(cfId);
      const wiksoParentId = commentMapping.get(comment.parentId);

      if (wiksoCommentId && wiksoParentId) {
        try {
          await this.prisma.comment.update({
            where: { id: wiksoCommentId },
            data: { parentId: wiksoParentId },
          });
        } catch (err: any) {
          this.logger.warn(`Failed to set comment parent: ${err.message}`);
        }
      }
    }
  }

  // ─── Create Tags ───────────────────────────────────────

  private async createTags(
    data: ParsedConfluenceData,
    pageMapping: Map<string, string>,
    spaceMapping: Map<string, string>,
    progress: ImportProgress,
  ) {
    for (const labelling of data.labellings) {
      try {
        if (!labelling.labelId || !labelling.contentId) continue;

        const label = data.labels.get(labelling.labelId);
        if (!label) continue;

        const wiksoPageId = pageMapping.get(labelling.contentId);
        if (!wiksoPageId) continue;

        // Get the page's space
        const page = await this.prisma.page.findUnique({
          where: { id: wiksoPageId },
          select: { spaceId: true },
        });
        if (!page) continue;

        // Find or create tag
        const tag = await this.prisma.tag.upsert({
          where: { name_spaceId: { name: label.name, spaceId: page.spaceId } },
          create: { name: label.name, spaceId: page.spaceId },
          update: {},
        });

        // Create page-tag association
        await this.prisma.pageTag.upsert({
          where: { pageId_tagId: { pageId: wiksoPageId, tagId: tag.id } },
          create: { pageId: wiksoPageId, tagId: tag.id },
          update: {},
        });

        progress.counts.tags++;
      } catch (err: any) {
        this.logger.warn(`Failed to create tag: ${err.message}`);
      }
    }
  }
}
