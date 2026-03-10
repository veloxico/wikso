import * as fs from 'fs';
import * as sax from 'sax';

// ─── Confluence Entity Interfaces ─────────────────────────

export interface CfSpace {
  id: string;
  key: string;
  name: string;
  spaceType: string;
  spaceStatus: string;
  description?: string; // filled from SpaceDescription body
}

export interface CfPage {
  id: string;
  title: string;
  position: number;
  parentId?: string;
  spaceId?: string;
  contentStatus: string;
  createdDate?: string;
  lastModifiedDate?: string;
  version?: number;
  originalVersionId?: string;
}

export interface CfBlogPost {
  id: string;
  title: string;
  spaceId?: string;
  contentStatus: string;
  createdDate?: string;
}

export interface CfBodyContent {
  id: string;
  bodyContentId?: string; // the Page/BlogPost/Comment ID this body belongs to
  body: string;
  bodyType: number; // 0 = XHTML storage format
}

export interface CfAttachment {
  id: string;
  title: string; // filename
  contentStatus: string;
  fileSize: number;
  mediaType?: string;
  containerId?: string; // page ID that owns the attachment
  version?: number;
}

export interface CfComment {
  id: string;
  parentId?: string; // parent comment ID (for threaded)
  containerId?: string; // page ID
  contentStatus: string;
  createdDate?: string;
}

export interface CfLabel {
  id: string;
  name: string;
  namespace: string;
}

export interface CfLabelling {
  id: string;
  labelId?: string;
  contentId?: string; // page ID
}

export interface CfSpaceDescription {
  id: string;
  spaceId?: string;
}

export interface ParsedConfluenceData {
  spaces: Map<string, CfSpace>;
  pages: Map<string, CfPage>;
  blogPosts: Map<string, CfBlogPost>;
  bodyContents: Map<string, CfBodyContent>;
  attachments: Map<string, CfAttachment>;
  comments: Map<string, CfComment>;
  labels: Map<string, CfLabel>;
  labellings: CfLabelling[];
  spaceDescriptions: Map<string, CfSpaceDescription>;
  /** Maps pageId → { spaceId, parentId } for ALL versions (including non-current) */
  pageMetaAll: Map<string, { spaceId?: string; parentId?: string }>;
}

// ─── SAX Streaming Parser ─────────────────────────────────

/**
 * Streams entities.xml via SAX to extract Confluence objects
 * without loading the entire 373MB file into memory.
 *
 * Confluence export XML structure:
 * <hibernate-generic datetime="...">
 *   <object class="Space" package="com.atlassian.confluence.spaces">
 *     <id name="id">12345</id>
 *     <property name="key">DEV</property>
 *     ...
 *   </object>
 *   ...
 * </hibernate-generic>
 */
export function parseConfluenceXml(
  xmlPath: string,
  onProgress?: (bytesRead: number, totalBytes: number) => void,
): Promise<ParsedConfluenceData> {
  return new Promise((resolve, reject) => {
    const result: ParsedConfluenceData = {
      spaces: new Map(),
      pages: new Map(),
      blogPosts: new Map(),
      bodyContents: new Map(),
      attachments: new Map(),
      comments: new Map(),
      labels: new Map(),
      labellings: [],
      spaceDescriptions: new Map(),
      pageMetaAll: new Map(),
    };

    const totalBytes = fs.statSync(xmlPath).size;
    let bytesRead = 0;
    let lastProgressReport = 0;

    // Parser state
    let currentObjectClass = '';
    let currentObject: Record<string, any> = {};
    let currentPropertyName = '';
    let currentElementName = ''; // 'id' | 'property' | 'collection'
    let inIdElement = false;
    let idName = '';
    let textBuffer = '';
    let depth = 0;
    let objectDepth = 0;
    let propertyDepth = 0;
    let inCollectionElement = false;
    let collectionName = '';
    let collectionItems: string[] = [];

    const parser = sax.createStream(false, {
      lowercase: true,
      trim: false,
    });

    parser.on('opentag', (node: sax.Tag) => {
      depth++;
      const tag = node.name;

      if (tag === 'object') {
        const cls = node.attributes['class'] as string || '';
        currentObjectClass = cls;
        currentObject = {};
        objectDepth = depth;
        return;
      }

      if (!currentObjectClass) return;

      if (tag === 'id' && depth === objectDepth + 1) {
        inIdElement = true;
        idName = (node.attributes['name'] as string) || 'id';
        textBuffer = '';
        return;
      }

      if (tag === 'property' && depth === objectDepth + 1) {
        currentPropertyName = (node.attributes['name'] as string) || '';
        currentElementName = 'property';
        propertyDepth = depth;
        textBuffer = '';

        // Check for reference property (e.g., <property name="space" class="Space"><id name="id">123</id></property>)
        const cls = node.attributes['class'] as string;
        if (cls) {
          // This is an object reference property — we need the nested <id>
          currentElementName = 'ref-property';
        }
        return;
      }

      if (tag === 'collection' && depth === objectDepth + 1) {
        collectionName = (node.attributes['name'] as string) || '';
        inCollectionElement = true;
        collectionItems = [];
        return;
      }

      // Inside a ref-property, grab the nested <id>
      if (tag === 'id' && currentElementName === 'ref-property') {
        inIdElement = true;
        textBuffer = '';
        return;
      }

      // Inside a collection, grab <element>
      if (tag === 'element' && inCollectionElement) {
        textBuffer = '';
        return;
      }
    });

    parser.on('text', (text: string) => {
      textBuffer += text;
    });

    parser.on('cdata', (cdata: string) => {
      textBuffer += cdata;
    });

    parser.on('closetag', (tag: string) => {
      if (tag === 'id' && inIdElement) {
        const val = textBuffer.trim();
        if (currentElementName === 'ref-property') {
          // This is the ID inside a reference property
          currentObject[currentPropertyName + 'Id'] = val;
          currentElementName = 'property'; // reset
        } else if (depth === objectDepth + 1) {
          // This is the object's own ID
          currentObject['id'] = val;
        }
        inIdElement = false;
        textBuffer = '';
        depth--;
        return;
      }

      if (tag === 'element' && inCollectionElement) {
        collectionItems.push(textBuffer.trim());
        textBuffer = '';
        depth--;
        return;
      }

      if (tag === 'property' && currentElementName && depth === propertyDepth) {
        const val = textBuffer.trim();
        if (currentPropertyName && currentElementName !== 'ref-property') {
          currentObject[currentPropertyName] = val;
        }
        currentElementName = '';
        currentPropertyName = '';
        textBuffer = '';
        depth--;
        return;
      }

      if (tag === 'collection' && inCollectionElement) {
        if (collectionName) {
          currentObject[collectionName] = collectionItems;
        }
        inCollectionElement = false;
        collectionName = '';
        collectionItems = [];
        depth--;
        return;
      }

      if (tag === 'object' && depth === objectDepth) {
        // Finished parsing an object — store it
        storeObject(currentObjectClass, currentObject, result);
        currentObjectClass = '';
        currentObject = {};
        depth--;
        return;
      }

      depth--;
    });

    parser.on('error', (err: Error) => {
      // SAX parsers often recover from errors in malformed XML
      // Reset the error and continue
      (parser as any)._parser.error = null;
      (parser as any)._parser.resume();
    });

    parser.on('end', () => {
      // Resolve space/parent for current pages from their originalVersion
      for (const [pageId, page] of result.pages) {
        if ((!page.spaceId || !page.parentId) && page.originalVersionId) {
          const meta = result.pageMetaAll.get(page.originalVersionId);
          if (meta) {
            if (!page.spaceId && meta.spaceId) {
              page.spaceId = meta.spaceId;
            }
            if (!page.parentId && meta.parentId) {
              page.parentId = meta.parentId;
            }
          }
        }
      }

      // ── Deduplicate pages ──────────────────────────────────
      // In Confluence Cloud exports, both the original page and newer
      // edited versions can have contentStatus='current'. We must keep
      // only the LATEST version of each page and remove superseded originals.
      const supersededOriginals = new Set<string>();
      const byOriginal = new Map<string, CfPage[]>();

      for (const [, page] of result.pages) {
        if (page.originalVersionId) {
          supersededOriginals.add(page.originalVersionId);
          if (!byOriginal.has(page.originalVersionId)) {
            byOriginal.set(page.originalVersionId, []);
          }
          byOriginal.get(page.originalVersionId)!.push(page);
        }
      }

      // If multiple newer versions share the same originalVersionId, keep only the latest
      for (const [, versions] of byOriginal) {
        if (versions.length > 1) {
          versions.sort((a, b) => (b.version || 0) - (a.version || 0));
          for (let i = 1; i < versions.length; i++) {
            result.pages.delete(versions[i].id);
          }
        }
      }

      // Remove original pages that have been superseded by newer versions
      for (const origId of supersededOriginals) {
        result.pages.delete(origId);
      }

      // ── Ensure surviving pages have body content ────────────
      // After dedup, a surviving page might have its body stored under
      // a different key (its own ID, the originalVersionId, or a deleted
      // sibling version ID). Collect the best body for each surviving page.
      for (const [pageId, page] of result.pages) {
        const hasBody = result.bodyContents.has(pageId);
        if (!hasBody && page.originalVersionId) {
          // Check if body exists under the original version ID
          const origBody = result.bodyContents.get(page.originalVersionId);
          if (origBody && origBody.body) {
            // Copy the reference so lookup by surviving page ID works
            result.bodyContents.set(pageId, origBody);
          }
        }
        // Also check all deleted sibling version IDs for the same original
        if (!result.bodyContents.has(pageId) && page.originalVersionId) {
          const siblings = byOriginal.get(page.originalVersionId) || [];
          let bestBody: CfBodyContent | undefined;
          for (const sibling of siblings) {
            const sibBody = result.bodyContents.get(sibling.id);
            if (sibBody && sibBody.body) {
              if (!bestBody ||
                  (sibBody.bodyType === 0 && bestBody.bodyType !== 0) ||
                  (sibBody.bodyType === bestBody.bodyType && sibBody.body.length > bestBody.body.length)) {
                bestBody = sibBody;
              }
            }
          }
          if (bestBody) {
            result.bodyContents.set(pageId, bestBody);
          }
        }
      }

      // Link space descriptions to spaces
      for (const [descId, desc] of result.spaceDescriptions) {
        const body = result.bodyContents.get(descId);
        if (body && desc.spaceId) {
          const space = result.spaces.get(desc.spaceId);
          if (space) {
            space.description = body.body;
          }
        }
      }
      resolve(result);
    });

    const readStream = fs.createReadStream(xmlPath, { highWaterMark: 256 * 1024 });

    readStream.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length;
      // Report progress at most every 5%
      const pct = Math.floor((bytesRead / totalBytes) * 100);
      if (onProgress && pct - lastProgressReport >= 5) {
        lastProgressReport = pct;
        onProgress(bytesRead, totalBytes);
      }
    });

    readStream.on('error', reject);
    readStream.pipe(parser);
  });
}

// ─── Object Storage ───────────────────────────────────────

function storeObject(
  className: string,
  obj: Record<string, any>,
  result: ParsedConfluenceData,
) {
  if (!obj.id) return;

  switch (className) {
    case 'Space': {
      const space: CfSpace = {
        id: obj.id,
        key: obj.key || '',
        name: obj.name || '',
        spaceType: obj.spaceType || 'collaboration',
        spaceStatus: obj.spaceStatus || 'CURRENT',
      };
      // Only keep CURRENT spaces
      if (space.spaceStatus === 'CURRENT') {
        result.spaces.set(space.id, space);
      }
      break;
    }

    case 'Page': {
      // Always store space/parent metadata from ALL versions (including non-current)
      // because in Confluence Cloud, current versions may not have space/parent —
      // they reference the original via originalVersionId
      if (obj.spaceId || obj.parentId) {
        result.pageMetaAll.set(obj.id, {
          spaceId: obj.spaceId || undefined,
          parentId: obj.parentId || undefined,
        });
      }

      const page: CfPage = {
        id: obj.id,
        title: obj.title || '',
        position: parseInt(obj.position) || 0,
        parentId: obj.parentId,
        spaceId: obj.spaceId || undefined,
        contentStatus: obj.contentStatus || '',
        createdDate: obj.creationDate,
        lastModifiedDate: obj.lastModificationDate,
        version: parseInt(obj.version) || 1,
        originalVersionId: obj.originalVersionId || undefined,
      };

      // Only keep current (latest) versions
      if (page.contentStatus === 'current') {
        const existing = result.pages.get(page.id);
        if (!existing || (page.version && existing.version && page.version > existing.version)) {
          result.pages.set(page.id, page);
        }
      }
      break;
    }

    case 'BlogPost': {
      const blog: CfBlogPost = {
        id: obj.id,
        title: obj.title || '',
        spaceId: obj.spaceId,
        contentStatus: obj.contentStatus || '',
        createdDate: obj.creationDate,
      };
      if (blog.contentStatus === 'current') {
        result.blogPosts.set(blog.id, blog);
      }
      break;
    }

    case 'BodyContent': {
      const body: CfBodyContent = {
        id: obj.id,
        bodyContentId: obj.contentId,
        body: obj.body || '',
        bodyType: parseInt(obj.bodyType) || 0,
      };
      // Store by the content ID it belongs to (page/comment ID).
      // Multiple BodyContent objects can share the same contentId (different bodyTypes
      // like XHTML storage=0, wiki=2, editor2=7). Prefer bodyType 0 (XHTML storage
      // format) since that's what our converter expects. Among same type, prefer longer.
      if (body.bodyContentId) {
        const existing = result.bodyContents.get(body.bodyContentId);
        if (
          !existing ||
          (body.bodyType === 0 && existing.bodyType !== 0) ||
          (body.bodyType === existing.bodyType && body.body.length > existing.body.length)
        ) {
          result.bodyContents.set(body.bodyContentId, body);
        }
      }
      break;
    }

    case 'Attachment': {
      const att: CfAttachment = {
        id: obj.id,
        title: obj.title || '',
        contentStatus: obj.contentStatus || '',
        fileSize: parseInt(obj.fileSize) || 0,
        mediaType: obj.contentType || obj.mediaType,
        containerId: obj.containerContentId || obj.containerId || obj.contentId,
        version: parseInt(obj.version) || 1,
      };
      if (att.contentStatus === 'current') {
        result.attachments.set(att.id, att);
      }
      break;
    }

    case 'Comment': {
      const comment: CfComment = {
        id: obj.id,
        parentId: obj.parentId,
        containerId: obj.containerContentId || obj.containerId || obj.contentId,
        contentStatus: obj.contentStatus || '',
        createdDate: obj.creationDate,
      };
      if (comment.contentStatus === 'current') {
        result.comments.set(comment.id, comment);
      }
      break;
    }

    case 'Label': {
      const label: CfLabel = {
        id: obj.id,
        name: obj.name || '',
        namespace: obj.namespace || 'global',
      };
      result.labels.set(label.id, label);
      break;
    }

    case 'Labelling': {
      const labelling: CfLabelling = {
        id: obj.id,
        labelId: obj.labelId,
        contentId: obj.contentId,
      };
      result.labellings.push(labelling);
      break;
    }

    case 'SpaceDescription': {
      const desc: CfSpaceDescription = {
        id: obj.id,
        spaceId: obj.spaceId,
      };
      result.spaceDescriptions.set(desc.id, desc);
      break;
    }

    // Skip all other object types
    default:
      break;
  }
}
