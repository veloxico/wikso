'use client';

import { useMemo } from 'react';
import { diffWords } from 'diff';

interface VersionDiffProps {
  oldContent: Record<string, unknown>;
  newContent: Record<string, unknown>;
  oldLabel?: string;
  newLabel?: string;
}

/**
 * Extracts plain text from a TipTap/ProseMirror JSON document.
 */
function extractText(node: any): string {
  if (!node) return '';

  if (node.type === 'text') {
    return node.text || '';
  }

  if (Array.isArray(node.content)) {
    return node.content
      .map((child: any) => {
        const text = extractText(child);
        // Add newlines for block elements
        if (
          ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'callout', 'horizontalRule', 'table', 'tableRow'].includes(
            child.type,
          )
        ) {
          return text + '\n';
        }
        return text;
      })
      .join('');
  }

  return '';
}

export function VersionDiff({ oldContent, newContent, oldLabel = 'Previous', newLabel = 'Current' }: VersionDiffProps) {
  const diff = useMemo(() => {
    const oldText = extractText(oldContent).trim();
    const newText = extractText(newContent).trim();
    return diffWords(oldText, newText);
  }, [oldContent, newContent]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    diff.forEach((part) => {
      if (part.added) added += part.value.length;
      if (part.removed) removed += part.value.length;
    });
    return { added, removed };
  }, [diff]);

  return (
    <div className="version-diff">
      {/* Header with stats */}
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span className="font-medium">{oldLabel} → {newLabel}</span>
        <div className="flex items-center gap-2">
          {stats.added > 0 && (
            <span className="text-green-600 dark:text-green-400">+{stats.added} chars</span>
          )}
          {stats.removed > 0 && (
            <span className="text-red-600 dark:text-red-400">-{stats.removed} chars</span>
          )}
          {stats.added === 0 && stats.removed === 0 && (
            <span>No changes</span>
          )}
        </div>
      </div>

      {/* Diff output */}
      <div className="rounded-lg border border-border bg-card p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
        {diff.map((part, index) => {
          if (part.added) {
            return (
              <span
                key={index}
                className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 rounded-sm px-0.5"
              >
                {part.value}
              </span>
            );
          }

          if (part.removed) {
            return (
              <span
                key={index}
                className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 rounded-sm px-0.5 line-through"
              >
                {part.value}
              </span>
            );
          }

          return <span key={index}>{part.value}</span>;
        })}
      </div>
    </div>
  );
}
