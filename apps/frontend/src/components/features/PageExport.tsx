'use client';

import { useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Copy, FileText, Printer } from 'lucide-react';

interface PageExportProps {
  editor: Editor | null;
  pageTitle: string;
}

/** Escape HTML special characters to prevent XSS when inserting into HTML templates. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function convertJsonToMarkdown(json: any): string {
  let markdown = '';

  const traverse = (node: any, depth: number = 0) => {
    if (!node) return;

    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level || 1;
        const heading = node.content
          ?.map((n: any) => n.text || '')
          .join('')
          .trim() || '';
        if (heading) {
          markdown += `${'#'.repeat(level)} ${heading}\n\n`;
        }
        break;
      }

      case 'paragraph': {
        const text = traverse_inline(node.content);
        if (text.trim()) {
          markdown += `${text}\n\n`;
        }
        break;
      }

      case 'bulletList': {
        if (node.content) {
          node.content.forEach((item: any) => {
            const text = traverse_inline(item.content);
            markdown += `- ${text}\n`;
          });
          markdown += '\n';
        }
        break;
      }

      case 'orderedList': {
        if (node.content) {
          node.content.forEach((item: any, index: number) => {
            const text = traverse_inline(item.content);
            markdown += `${index + 1}. ${text}\n`;
          });
          markdown += '\n';
        }
        break;
      }

      case 'codeBlock': {
        const code = node.content
          ?.map((n: any) => n.text || '')
          .join('')
          .trim() || '';
        const language = node.attrs?.language || '';
        markdown += `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
        break;
      }

      case 'blockquote': {
        const text = traverse_inline(node.content);
        markdown += `> ${text}\n\n`;
        break;
      }

      case 'table': {
        if (node.content) {
          node.content.forEach((row: any) => {
            if (row.type === 'tableRow') {
              const cells = row.content
                ?.map((cell: any) => {
                  const cellText = traverse_inline(cell.content);
                  return cellText.trim();
                })
                .join(' | ') || '';
              markdown += `| ${cells} |\n`;
            }
          });
          markdown += '\n';
        }
        break;
      }

      case 'horizontalRule': {
        markdown += '---\n\n';
        break;
      }

      case 'image': {
        const src = node.attrs?.src || '';
        const alt = node.attrs?.alt || 'Image';
        markdown += `![${alt}](${src})\n\n`;
        break;
      }

      default: {
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach((child: any) => traverse(child, depth + 1));
        }
      }
    }
  };

  function traverse_inline(content: any): string {
    if (!content) return '';
    let text = '';

    content.forEach((node: any) => {
      if (node.type === 'text') {
        let nodeText = node.text || '';

        // Apply marks
        if (node.marks) {
          let linkHref: string | null = null;
          node.marks.forEach((mark: any) => {
            if (mark.type === 'bold') {
              nodeText = `**${nodeText}**`;
            } else if (mark.type === 'italic') {
              nodeText = `*${nodeText}*`;
            } else if (mark.type === 'code') {
              nodeText = `\`${nodeText}\``;
            } else if (mark.type === 'strike') {
              nodeText = `~~${nodeText}~~`;
            } else if (mark.type === 'link') {
              linkHref = mark.attrs?.href || '';
            }
          });
          if (linkHref) {
            nodeText = `[${nodeText}](${linkHref})`;
          }
        }

        text += nodeText;
      } else if (node.type === 'hardBreak') {
        text += '\n';
      } else if (node.type === 'link') {
        const href = node.attrs?.href || '';
        const linkText = traverse_inline(node.content);
        text += `[${linkText}](${href})`;
      }
    });

    return text;
  }

  if (json && json.content) {
    json.content.forEach((node: any) => traverse(node));
  }

  return markdown.trim();
}

export function PageExport({ editor, pageTitle }: PageExportProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDownloadMarkdown = () => {
    if (!editor) return;

    const json = editor.getJSON();
    const markdown = convertJsonToMarkdown(json);
    const content = `# ${pageTitle}\n\n${markdown}`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pageTitle.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadHtml = () => {
    if (!editor) return;

    const html = editor.getHTML();
    const safeTitle = escapeHtml(pageTitle);
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { margin-top: 1em; margin-bottom: 0.5em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 3px solid #999; margin-left: 0; padding-left: 12px; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    table td, table th { border: 1px solid #ddd; padding: 8px; text-align: left; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  ${html}
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pageTitle.toLowerCase().replace(/\s+/g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyAsText = async () => {
    if (!editor) return;

    const json = editor.getJSON();
    const markdown = convertJsonToMarkdown(json);
    const text = `${pageTitle}\n\n${markdown}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handlePrintPdf = () => {
    if (!editor) return;

    const html = editor.getHTML();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const safeTitlePrint = escapeHtml(pageTitle);
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${safeTitlePrint}</title>
  <style>
    @media print {
      @page { margin: 20mm; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #1a1a1a;
    }
    h1 { font-size: 2em; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; margin-top: 1.5em; }
    h3 { font-size: 1.25em; margin-top: 1.2em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #3b82f6; margin-left: 0; padding-left: 16px; color: #555; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    td, th { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f8f8f8; font-weight: 600; }
    img { max-width: 100%; height: auto; border-radius: 4px; }
    ul[data-type="taskList"] { list-style: none; padding: 0; }
    ul[data-type="taskList"] li { display: flex; gap: 8px; }
    hr { border: none; border-top: 1px solid #eee; margin: 1.5em 0; }
    .mention { background: #e0e7ff; color: #3730a3; padding: 1px 4px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>${safeTitlePrint}</h1>
  ${html}
  <script>window.onload = function() { window.print(); window.close(); }<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          {t('editor.export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleDownloadMarkdown} className="gap-2">
          <FileText className="w-4 h-4" />
          <span>{t('editor.exportMarkdown')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadHtml} className="gap-2">
          <FileText className="w-4 h-4" />
          <span>{t('editor.exportHtml')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyAsText} className="gap-2">
          <Copy className="w-4 h-4" />
          <span>
            {copied ? t('editor.copied') : t('editor.copyText')}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrintPdf} className="gap-2">
          <Printer className="w-4 h-4" />
          <span>{t('editor.exportPdf') || 'Export as PDF'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
