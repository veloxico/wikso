import * as htmlparser2 from 'htmlparser2';

/**
 * Converts Confluence Storage Format XHTML to TipTap/ProseMirror JSON.
 *
 * Confluence uses an XHTML-based storage format with custom namespaced elements
 * (ac:*, ri:*) for macros, images, tasks, etc. This converter transforms that
 * into the TipTap JSON schema used by Wikso.
 */

// ─── Types ────────────────────────────────────────────────

interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, any>;
}

// ─── Converter ────────────────────────────────────────────

export function convertConfluenceToTipTap(
  html: string,
  attachmentUrlResolver?: (filename: string, pageId?: string) => string,
): TipTapNode {
  if (!html || !html.trim()) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  // Wrap in root element to handle fragments
  const wrapped = `<root>${html}</root>`;

  const doc: TipTapNode = { type: 'doc', content: [] };
  const stack: TipTapNode[] = [doc];
  const markStack: TipTapMark[][] = [[]];

  // State for Confluence macro processing (stack-based for nesting)
  interface MacroState {
    name: string;
    params: Record<string, string>;
    depth: number;
    bodyBuffer: TipTapNode[];
    inPlainTextBody: boolean;
    plainTextBuffer: string;
    currentParamName: string;
  }
  const macroStack: MacroState[] = [];

  function isInMacro(): boolean {
    return macroStack.length > 0;
  }

  function currentMacro(): MacroState | undefined {
    return macroStack[macroStack.length - 1];
  }

  // State for ac:task processing
  let inTaskList = false;
  let inTask = false;
  let taskChecked = false;
  let inTaskBody = false;
  let inTaskStatus = false;
  let taskStatusBuffer = '';

  // State for ac:image processing
  let inImage = false;
  let imageAttrs: Record<string, any> = {};

  // State for ac:link processing
  let inLink = false;
  let linkPageTitle = '';
  let linkHref = '';

  // State for time element
  let inTime = false;
  let timeValue = '';

  const parser = new htmlparser2.Parser(
    {
      onopentag(name: string, attribs: Record<string, string>) {
        const tag = name.toLowerCase();

        // ─── Confluence Macros ──────────────────────
        if (tag === 'ac:structured-macro') {
          macroStack.push({
            name: attribs['ac:name'] || attribs['name'] || '',
            params: {},
            depth: 0,
            bodyBuffer: [],
            inPlainTextBody: false,
            plainTextBuffer: '',
            currentParamName: '_last',
          });
          return;
        }

        if (isInMacro() && tag === 'ac:parameter') {
          // Track the parameter name so ontext stores under the correct key
          const macro = currentMacro()!;
          macro.currentParamName = attribs['ac:name'] || attribs['name'] || '_last';
          return;
        }

        if (isInMacro() && tag === 'ac:plain-text-body') {
          const macro = currentMacro()!;
          macro.inPlainTextBody = true;
          macro.plainTextBuffer = '';
          return;
        }

        if (isInMacro() && (tag === 'ac:rich-text-body' || tag === 'ac:default-parameter')) {
          currentMacro()!.depth++;
          // Push a temporary container for the rich text body
          const container: TipTapNode = { type: '_macro_body', content: [] };
          stack.push(container);
          markStack.push([]);
          return;
        }

        // ─── Confluence Task Lists ──────────────────
        if (tag === 'ac:task-list') {
          inTaskList = true;
          const taskList: TipTapNode = { type: 'taskList', content: [] };
          current().content = current().content || [];
          current().content!.push(taskList);
          stack.push(taskList);
          markStack.push([]);
          return;
        }

        if (tag === 'ac:task') {
          inTask = true;
          taskChecked = false;
          return;
        }

        if (tag === 'ac:task-status') {
          inTaskStatus = true;
          taskStatusBuffer = '';
          return;
        }

        if (tag === 'ac:task-id') {
          // Skip — we don't need Confluence task IDs
          return;
        }

        if (tag === 'ac:task-body') {
          inTaskBody = true;
          const taskItem: TipTapNode = {
            type: 'taskItem',
            attrs: { checked: taskChecked },
            content: [],
          };
          current().content = current().content || [];
          current().content!.push(taskItem);
          stack.push(taskItem);
          markStack.push([]);
          return;
        }

        // ─── Confluence Images ──────────────────────
        if (tag === 'ac:image') {
          inImage = true;
          imageAttrs = {
            alignment: attribs['ac:align'] || attribs['align'] || 'center',
            width: attribs['ac:width'] || attribs['width'] || null,
            alt: attribs['ac:alt'] || attribs['alt'] || null,
            title: attribs['ac:title'] || attribs['title'] || null,
          };
          return;
        }

        if (inImage && tag === 'ri:attachment') {
          const filename = attribs['ri:filename'] || attribs['filename'] || '';
          if (attachmentUrlResolver) {
            imageAttrs.src = attachmentUrlResolver(filename);
          } else {
            // Placeholder — will be fixed up later
            imageAttrs.src = `__confluence_attachment__:${filename}`;
          }
          imageAttrs.alt = imageAttrs.alt || filename;
          return;
        }

        if (inImage && tag === 'ri:url') {
          imageAttrs.src = attribs['ri:value'] || attribs['value'] || '';
          return;
        }

        // ─── Confluence Links ───────────────────────
        if (tag === 'ac:link') {
          inLink = true;
          linkPageTitle = '';
          linkHref = attribs['ri:href'] || attribs['href'] || '';
          return;
        }

        if (inLink && tag === 'ri:page') {
          linkPageTitle = attribs['ri:content-title'] || attribs['content-title'] || '';
          return;
        }

        if (inLink && tag === 'ri:attachment') {
          const filename = attribs['ri:filename'] || attribs['filename'] || '';
          if (attachmentUrlResolver) {
            linkHref = attachmentUrlResolver(filename);
          } else {
            linkHref = `__confluence_attachment__:${filename}`;
          }
          return;
        }

        if (inLink && (tag === 'ac:plain-text-link-body' || tag === 'ac:link-body')) {
          // Text content will be captured
          return;
        }

        // ─── Confluence Layout (flatten) ────────────
        if (tag === 'ac:layout' || tag === 'ac:layout-section' || tag === 'ac:layout-cell') {
          // Just pass through — the content inside will be rendered as-is
          return;
        }

        // ─── Time ──────────────────────────────────
        if (tag === 'time') {
          inTime = true;
          timeValue = attribs['datetime'] || '';
          return;
        }

        // ─── Standard HTML Elements ────────────────

        // Block elements
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
          const level = Math.min(parseInt(tag[1]), 3); // Wikso supports max 3 levels
          const heading: TipTapNode = { type: 'heading', attrs: { level }, content: [] };
          current().content = current().content || [];
          current().content!.push(heading);
          stack.push(heading);
          markStack.push([...currentMarks()]);
          return;
        }

        if (tag === 'p') {
          const para: TipTapNode = { type: 'paragraph', content: [] };
          current().content = current().content || [];
          current().content!.push(para);
          stack.push(para);
          markStack.push([...currentMarks()]);
          return;
        }

        if (tag === 'blockquote') {
          const bq: TipTapNode = { type: 'blockquote', content: [] };
          current().content = current().content || [];
          current().content!.push(bq);
          stack.push(bq);
          markStack.push([]);
          return;
        }

        if (tag === 'hr') {
          current().content = current().content || [];
          current().content!.push({ type: 'horizontalRule' });
          return;
        }

        if (tag === 'br') {
          // Hard break — add as a node
          current().content = current().content || [];
          current().content!.push({ type: 'hardBreak' });
          return;
        }

        if (tag === 'pre') {
          // Usually contains <code>, will be handled on <code> close
          return;
        }

        // Lists
        if (tag === 'ul') {
          const list: TipTapNode = { type: 'bulletList', content: [] };
          current().content = current().content || [];
          current().content!.push(list);
          stack.push(list);
          markStack.push([]);
          return;
        }

        if (tag === 'ol') {
          const list: TipTapNode = { type: 'orderedList', content: [] };
          current().content = current().content || [];
          current().content!.push(list);
          stack.push(list);
          markStack.push([]);
          return;
        }

        if (tag === 'li') {
          const item: TipTapNode = { type: 'listItem', content: [{ type: 'paragraph', content: [] }] };
          current().content = current().content || [];
          current().content!.push(item);
          stack.push(item);
          markStack.push([]);
          // Push the inner paragraph too for text content
          stack.push(item.content![0]);
          markStack.push([]);
          return;
        }

        // Tables
        if (tag === 'table') {
          const table: TipTapNode = { type: 'table', content: [] };
          current().content = current().content || [];
          current().content!.push(table);
          stack.push(table);
          markStack.push([]);
          return;
        }

        if (tag === 'tbody' || tag === 'thead' || tag === 'tfoot') {
          // Pass through — we don't need these wrappers
          return;
        }

        if (tag === 'tr') {
          const row: TipTapNode = { type: 'tableRow', content: [] };
          current().content = current().content || [];
          current().content!.push(row);
          stack.push(row);
          markStack.push([]);
          return;
        }

        if (tag === 'th') {
          const cell: TipTapNode = { type: 'tableHeader', content: [{ type: 'paragraph', content: [] }] };
          current().content = current().content || [];
          current().content!.push(cell);
          stack.push(cell);
          markStack.push([]);
          // Push inner paragraph for text
          stack.push(cell.content![0]);
          markStack.push([]);
          return;
        }

        if (tag === 'td') {
          const cell: TipTapNode = { type: 'tableCell', content: [{ type: 'paragraph', content: [] }] };
          current().content = current().content || [];
          current().content!.push(cell);
          stack.push(cell);
          markStack.push([]);
          // Push inner paragraph for text
          stack.push(cell.content![0]);
          markStack.push([]);
          return;
        }

        // Inline marks
        if (tag === 'strong' || tag === 'b') {
          markStack[markStack.length - 1] = [...currentMarks(), { type: 'bold' }];
          return;
        }

        if (tag === 'em' || tag === 'i') {
          markStack[markStack.length - 1] = [...currentMarks(), { type: 'italic' }];
          return;
        }

        if (tag === 'u') {
          markStack[markStack.length - 1] = [...currentMarks(), { type: 'underline' }];
          return;
        }

        if (tag === 's' || tag === 'del' || tag === 'strike') {
          markStack[markStack.length - 1] = [...currentMarks(), { type: 'strike' }];
          return;
        }

        if (tag === 'code') {
          // Check if parent is <pre> — if so, this is a code block not inline code
          const parentType = current().type;
          if (parentType === 'doc' || parentType === '_macro_body') {
            // Code block
            const lang = attribs['class']?.replace('language-', '') || null;
            const cb: TipTapNode = { type: 'codeBlock', attrs: { language: lang }, content: [] };
            current().content = current().content || [];
            current().content!.push(cb);
            stack.push(cb);
            markStack.push([]);
            return;
          }
          // Inline code
          markStack[markStack.length - 1] = [...currentMarks(), { type: 'code' }];
          return;
        }

        if (tag === 'sup') {
          markStack[markStack.length - 1] = [...currentMarks(), { type: 'superscript' }];
          return;
        }

        if (tag === 'sub') {
          markStack[markStack.length - 1] = [...currentMarks(), { type: 'subscript' }];
          return;
        }

        if (tag === 'a') {
          const href = attribs['href'] || '';
          if (href) {
            markStack[markStack.length - 1] = [
              ...currentMarks(),
              { type: 'link', attrs: { href } },
            ];
          }
          return;
        }

        if (tag === 'span') {
          // Check for text color or highlight
          const style = attribs['style'] || '';
          const colorMatch = style.match(/color:\s*([^;]+)/);
          if (colorMatch) {
            markStack[markStack.length - 1] = [
              ...currentMarks(),
              { type: 'textStyle', attrs: { color: colorMatch[1].trim() } },
            ];
          }
          return;
        }

        // img tag (standard HTML images)
        if (tag === 'img') {
          const node: TipTapNode = {
            type: 'image',
            attrs: {
              src: attribs['src'] || '',
              alt: attribs['alt'] || null,
              title: attribs['title'] || null,
              width: attribs['width'] || null,
              alignment: 'center',
              caption: '',
            },
          };
          current().content = current().content || [];
          current().content!.push(node);
          return;
        }

        // div — treat as transparent wrapper
        if (tag === 'div') {
          return;
        }
      },

      ontext(text: string) {
        if (inTime) {
          timeValue = timeValue || text;
          return;
        }

        if (inTaskStatus) {
          taskStatusBuffer += text;
          return;
        }

        if (currentMacro()?.inPlainTextBody) {
          currentMacro()!.plainTextBuffer += text;
          return;
        }

        if (isInMacro() && !currentMacro()!.depth) {
          // Capture macro parameter text under the correct param name
          const trimmed = text.trim();
          if (trimmed) {
            const macro = currentMacro()!;
            const key = macro.currentParamName;
            macro.params[key] = (macro.params[key] || '') + text;
          }
          return;
        }

        if (inLink) {
          // Capture link body text
          linkPageTitle = linkPageTitle || text.trim();
          return;
        }

        if (!text) return;

        // Don't add whitespace-only text to non-inline contexts
        const cur = current();
        if (!cur) return;

        const trimmed = text.replace(/\n/g, ' ');
        if (!trimmed.trim() && ['doc', 'table', 'tableRow', 'bulletList', 'orderedList', 'taskList'].includes(cur.type)) {
          return;
        }

        if (trimmed) {
          addText(trimmed);
        }
      },

      onclosetag(name: string) {
        const tag = name.toLowerCase();

        // ─── Confluence Macros Close ────────────────
        if (tag === 'ac:structured-macro' && isInMacro()) {
          handleMacroClose();
          return;
        }

        if (isInMacro() && tag === 'ac:parameter') {
          // Parameter text was stored; reset param name for next parameter
          currentMacro()!.currentParamName = '_last';
          return;
        }

        if (tag === 'ac:plain-text-body' && isInMacro()) {
          currentMacro()!.inPlainTextBody = false;
          return;
        }

        if (isInMacro() && (tag === 'ac:rich-text-body' || tag === 'ac:default-parameter')) {
          const macro = currentMacro()!;
          macro.depth--;
          const container = stack.pop()!;
          markStack.pop();
          macro.bodyBuffer = container.content || [];
          return;
        }

        // ─── Task elements close ────────────────────
        if (tag === 'ac:task-list') {
          inTaskList = false;
          stack.pop();
          markStack.pop();
          return;
        }

        if (tag === 'ac:task') {
          inTask = false;
          return;
        }

        if (tag === 'ac:task-status') {
          inTaskStatus = false;
          taskChecked = taskStatusBuffer.trim().toLowerCase() === 'complete';
          return;
        }

        if (tag === 'ac:task-id') {
          return;
        }

        if (tag === 'ac:task-body') {
          inTaskBody = false;
          // Update the task_item's checked status
          const taskItem = current();
          if (taskItem && taskItem.type === 'taskItem') {
            taskItem.attrs = { checked: taskChecked };
          }
          stack.pop();
          markStack.pop();
          return;
        }

        // ─── Image close ────────────────────────────
        if (tag === 'ac:image') {
          if (inImage && imageAttrs.src) {
            const imgNode: TipTapNode = {
              type: 'image',
              attrs: {
                src: imageAttrs.src,
                alt: imageAttrs.alt || null,
                title: imageAttrs.title || null,
                width: imageAttrs.width || null,
                alignment: imageAttrs.alignment || 'center',
                caption: '',
              },
            };
            current().content = current().content || [];
            current().content!.push(imgNode);
          }
          inImage = false;
          imageAttrs = {};
          return;
        }

        if (inImage && (tag === 'ri:attachment' || tag === 'ri:url')) {
          return;
        }

        // ─── Link close ─────────────────────────────
        if (tag === 'ac:link') {
          if (inLink) {
            const displayText = linkPageTitle || linkHref || 'link';
            if (linkPageTitle && !linkHref) {
              // Internal page link — use placeholder
              linkHref = `__confluence_page__:${linkPageTitle}`;
            }
            if (linkHref) {
              const marks: TipTapMark[] = [
                ...currentMarks(),
                { type: 'link', attrs: { href: linkHref } },
              ];
              const textNode: TipTapNode = {
                type: 'text',
                text: displayText,
                marks,
              };
              current().content = current().content || [];
              current().content!.push(textNode);
            }
          }
          inLink = false;
          linkPageTitle = '';
          linkHref = '';
          return;
        }

        if (inLink && (tag === 'ri:page' || tag === 'ri:attachment' || tag === 'ac:plain-text-link-body' || tag === 'ac:link-body')) {
          return;
        }

        // ─── Layout close (pass through) ────────────
        if (tag === 'ac:layout' || tag === 'ac:layout-section' || tag === 'ac:layout-cell') {
          return;
        }

        // ─── Time close ─────────────────────────────
        if (tag === 'time') {
          if (inTime && timeValue) {
            try {
              const date = new Date(timeValue);
              const formatted = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              addText(formatted);
            } catch {
              addText(timeValue);
            }
          }
          inTime = false;
          timeValue = '';
          return;
        }

        // ─── Standard HTML close ────────────────────
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
          stack.pop();
          markStack.pop();
          return;
        }

        if (tag === 'p') {
          stack.pop();
          markStack.pop();
          return;
        }

        if (tag === 'blockquote') {
          stack.pop();
          markStack.pop();
          return;
        }

        if (tag === 'ul' || tag === 'ol') {
          stack.pop();
          markStack.pop();
          return;
        }

        if (tag === 'li') {
          // Pop inner paragraph + list_item
          stack.pop();
          markStack.pop();
          stack.pop();
          markStack.pop();
          return;
        }

        if (tag === 'table') {
          stack.pop();
          markStack.pop();
          return;
        }

        if (tag === 'tbody' || tag === 'thead' || tag === 'tfoot') {
          return;
        }

        if (tag === 'tr') {
          stack.pop();
          markStack.pop();
          return;
        }

        if (tag === 'th' || tag === 'td') {
          // Pop inner paragraph + cell
          stack.pop();
          markStack.pop();
          stack.pop();
          markStack.pop();
          return;
        }

        if (tag === 'code') {
          // Check if we pushed a code_block
          if (current().type === 'codeBlock') {
            stack.pop();
            markStack.pop();
            return;
          }
          // Inline code — remove mark
          markStack[markStack.length - 1] = currentMarks().filter((m) => m.type !== 'code');
          return;
        }

        // Remove inline marks
        if (tag === 'strong' || tag === 'b') {
          markStack[markStack.length - 1] = currentMarks().filter((m) => m.type !== 'bold');
          return;
        }
        if (tag === 'em' || tag === 'i') {
          markStack[markStack.length - 1] = currentMarks().filter((m) => m.type !== 'italic');
          return;
        }
        if (tag === 'u') {
          markStack[markStack.length - 1] = currentMarks().filter((m) => m.type !== 'underline');
          return;
        }
        if (tag === 's' || tag === 'del' || tag === 'strike') {
          markStack[markStack.length - 1] = currentMarks().filter((m) => m.type !== 'strike');
          return;
        }
        if (tag === 'sup') {
          markStack[markStack.length - 1] = currentMarks().filter((m) => m.type !== 'superscript');
          return;
        }
        if (tag === 'sub') {
          markStack[markStack.length - 1] = currentMarks().filter((m) => m.type !== 'subscript');
          return;
        }
        if (tag === 'a') {
          markStack[markStack.length - 1] = currentMarks().filter((m) => m.type !== 'link');
          return;
        }
        if (tag === 'span') {
          markStack[markStack.length - 1] = currentMarks().filter((m) => m.type !== 'textStyle');
          return;
        }
      },
    },
    {
      decodeEntities: true,
      lowerCaseTags: true,
      lowerCaseAttributeNames: false,
      recognizeSelfClosing: true,
    },
  );

  // ─── Helper Functions ─────────────────────────────────

  function current(): TipTapNode {
    return stack[stack.length - 1];
  }

  function currentMarks(): TipTapMark[] {
    return markStack[markStack.length - 1] || [];
  }

  function addText(text: string) {
    const cur = current();
    if (!cur) return;

    // Some nodes can't contain text directly — wrap in paragraph
    if (['doc', 'blockquote', 'listItem', 'tableCell', 'tableHeader', 'callout', 'taskItem'].includes(cur.type)) {
      // Check if last child is a paragraph we can append to
      const lastChild = cur.content?.[cur.content.length - 1];
      if (lastChild && lastChild.type === 'paragraph') {
        lastChild.content = lastChild.content || [];
        const marks = currentMarks().length > 0 ? currentMarks() : undefined;
        lastChild.content.push({ type: 'text', text, ...(marks ? { marks: [...marks] } : {}) });
        return;
      }
      // Create new paragraph
      const marks = currentMarks().length > 0 ? currentMarks() : undefined;
      const para: TipTapNode = {
        type: 'paragraph',
        content: [{ type: 'text', text, ...(marks ? { marks: [...marks] } : {}) }],
      };
      cur.content = cur.content || [];
      cur.content.push(para);
      return;
    }

    cur.content = cur.content || [];
    const marks = currentMarks().length > 0 ? currentMarks() : undefined;
    cur.content.push({ type: 'text', text, ...(marks ? { marks: [...marks] } : {}) });
  }

  function handleMacroClose() {
    const macro = macroStack.pop();
    if (!macro) return;

    const { name, params, bodyBuffer, plainTextBuffer: ptBuffer } = macro;

    switch (name) {
      case 'code': {
        const lang = params['language'] || params['_last'] || null;
        const codeBlock: TipTapNode = {
          type: 'codeBlock',
          attrs: { language: lang },
          content: ptBuffer
            ? [{ type: 'text', text: ptBuffer }]
            : [],
        };
        current().content = current().content || [];
        current().content!.push(codeBlock);
        break;
      }

      case 'noformat': {
        const codeBlock: TipTapNode = {
          type: 'codeBlock',
          attrs: { language: null },
          content: ptBuffer
            ? [{ type: 'text', text: ptBuffer }]
            : [],
        };
        current().content = current().content || [];
        current().content!.push(codeBlock);
        break;
      }

      case 'info':
      case 'tip': {
        const callout: TipTapNode = {
          type: 'callout',
          attrs: { type: 'info' },
          content: bodyBuffer.length > 0 ? bodyBuffer : [{ type: 'paragraph' }],
        };
        current().content = current().content || [];
        current().content!.push(callout);
        break;
      }

      case 'note':
      case 'warning': {
        const callout: TipTapNode = {
          type: 'callout',
          attrs: { type: 'warning' },
          content: bodyBuffer.length > 0 ? bodyBuffer : [{ type: 'paragraph' }],
        };
        current().content = current().content || [];
        current().content!.push(callout);
        break;
      }

      case 'expand':
      case 'panel': {
        // Render as a callout with info type
        const callout: TipTapNode = {
          type: 'callout',
          attrs: { type: 'info' },
          content: bodyBuffer.length > 0 ? bodyBuffer : [{ type: 'paragraph' }],
        };
        current().content = current().content || [];
        current().content!.push(callout);
        break;
      }

      case 'status': {
        // Inline status badge — render as bold text
        const statusText = params['title'] || params['_last'] || '';
        if (statusText) {
          addText(`[${statusText}]`);
        }
        break;
      }

      case 'toc':
      case 'children':
      case 'recently-updated':
      case 'contributors':
      case 'excerpt':
      case 'pagetree':
      case 'livesearch':
      case 'anchor': {
        // Dynamic/unsupported macros — skip silently
        break;
      }

      // Layout macros — transparent pass-through (content flows to parent)
      case 'section':
      case 'column': {
        if (bodyBuffer.length > 0) {
          for (const node of bodyBuffer) {
            current().content = current().content || [];
            current().content!.push(node);
          }
        }
        break;
      }

      default: {
        // Unknown macro — if it has a rich-text body, render the content
        if (bodyBuffer.length > 0) {
          for (const node of bodyBuffer) {
            current().content = current().content || [];
            current().content!.push(node);
          }
        } else if (ptBuffer) {
          // Render plain text as a code block
          const codeBlock: TipTapNode = {
            type: 'codeBlock',
            attrs: { language: null },
            content: [{ type: 'text', text: ptBuffer }],
          };
          current().content = current().content || [];
          current().content!.push(codeBlock);
        }
        break;
      }
    }
  }

  parser.write(wrapped);
  parser.end();

  // Clean up the doc
  normalizeDoc(doc);

  return doc;
}

// ─── Post-processing ──────────────────────────────────────

function normalizeDoc(doc: TipTapNode) {
  if (!doc.content || doc.content.length === 0) {
    doc.content = [{ type: 'paragraph' }];
    return;
  }

  // Remove _macro_body wrappers
  doc.content = flattenContent(doc.content);

  // Ensure doc has at least one block element
  if (doc.content.length === 0) {
    doc.content = [{ type: 'paragraph' }];
  }

  // Wrap orphaned text nodes in paragraphs
  const newContent: TipTapNode[] = [];
  for (const node of doc.content) {
    if (node.type === 'text') {
      newContent.push({ type: 'paragraph', content: [node] });
    } else {
      newContent.push(node);
    }
  }
  doc.content = newContent;

  // Recursively clean empty content arrays
  cleanEmptyContent(doc);
}

function flattenContent(nodes: TipTapNode[]): TipTapNode[] {
  const result: TipTapNode[] = [];
  for (const node of nodes) {
    if (node.type === '_macro_body') {
      if (node.content) {
        result.push(...flattenContent(node.content));
      }
    } else {
      if (node.content) {
        node.content = flattenContent(node.content);
      }
      result.push(node);
    }
  }
  return result;
}

function cleanEmptyContent(node: TipTapNode) {
  if (node.content) {
    // Remove nodes that are empty paragraphs with no text
    node.content = node.content.filter((child) => {
      if (child.type === 'text' && !child.text?.trim()) return false;
      return true;
    });

    for (const child of node.content) {
      cleanEmptyContent(child);
    }

    // If a block node has empty content, add an empty paragraph
    if (node.content.length === 0) {
      if (['blockquote', 'callout', 'listItem', 'tableCell', 'tableHeader', 'taskItem'].includes(node.type)) {
        node.content = [{ type: 'paragraph' }];
      }
    }
  }
}

// ─── Utility: Fix attachment references in contentJson ────

/**
 * Walk a TipTap JSON tree and replace `__confluence_attachment__:filename`
 * placeholders with actual Wikso attachment URLs.
 */
export function fixAttachmentReferences(
  doc: TipTapNode,
  resolver: (filename: string) => string | null,
): TipTapNode {
  if (!doc) return doc;

  if (doc.type === 'image' && doc.attrs?.src) {
    const src = doc.attrs.src as string;
    if (src.startsWith('__confluence_attachment__:')) {
      const filename = src.replace('__confluence_attachment__:', '');
      const resolved = resolver(filename);
      if (resolved) {
        doc.attrs.src = resolved;
      }
    }
  }

  // Fix link marks
  if (doc.marks) {
    for (const mark of doc.marks) {
      if (mark.type === 'link' && mark.attrs?.href) {
        const href = mark.attrs.href as string;
        if (href.startsWith('__confluence_attachment__:')) {
          const filename = href.replace('__confluence_attachment__:', '');
          const resolved = resolver(filename);
          if (resolved) {
            mark.attrs.href = resolved;
          }
        }
      }
    }
  }

  if (doc.content) {
    for (const child of doc.content) {
      fixAttachmentReferences(child, resolver);
    }
  }

  return doc;
}

/**
 * Walk a TipTap JSON tree and replace `__confluence_page__:Title`
 * placeholders with actual Wikso page URLs.
 */
export function fixPageReferences(
  doc: TipTapNode,
  resolver: (title: string) => string | null,
): TipTapNode {
  if (!doc) return doc;

  if (doc.marks) {
    for (const mark of doc.marks) {
      if (mark.type === 'link' && mark.attrs?.href) {
        const href = mark.attrs.href as string;
        if (href.startsWith('__confluence_page__:')) {
          const title = href.replace('__confluence_page__:', '');
          const resolved = resolver(title);
          if (resolved) {
            mark.attrs.href = resolved;
          }
        }
      }
    }
  }

  if (doc.content) {
    for (const child of doc.content) {
      fixPageReferences(child, resolver);
    }
  }

  return doc;
}
