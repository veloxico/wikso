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
      {/* Header with stats — labels use ui-font, numbers tabular */}
      <div
        className="flex items-center gap-4 mb-3 text-[11.5px]"
        style={{ color: 'var(--ink-4)', fontFamily: 'var(--ui-font)' }}
      >
        <span
          className="font-semibold uppercase"
          style={{ letterSpacing: '0.06em', color: 'var(--ink-3)' }}
        >
          {oldLabel} <span style={{ color: 'var(--ink-4)' }}>→</span> {newLabel}
        </span>
        <div className="flex items-center gap-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {stats.added > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--diff-add, oklch(60% 0.13 150))',
                }}
              />
              +{stats.added}
            </span>
          )}
          {stats.removed > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--diff-del, oklch(60% 0.16 30))',
                }}
              />
              -{stats.removed}
            </span>
          )}
          {stats.added === 0 && stats.removed === 0 && (
            <span style={{ color: 'var(--ink-4)' }}>No changes</span>
          )}
        </div>
      </div>

      {/* Diff output — warm paper card with mono body */}
      <div
        className="p-4 leading-relaxed whitespace-pre-wrap"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--rule)',
          borderRadius: 10,
          fontFamily: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace',
          fontSize: '13px',
          color: 'var(--ink-2)',
          maxHeight: '50vh',
          overflowY: 'auto',
        }}
      >
        {diff.map((part, index) => {
          if (part.added) {
            return (
              <span
                key={index}
                style={{
                  background: 'oklch(94% 0.06 150 / 0.55)',
                  color: 'oklch(38% 0.10 150)',
                  padding: '0 3px',
                  borderRadius: 3,
                  borderBottom: '1px solid oklch(60% 0.13 150)',
                }}
              >
                {part.value}
              </span>
            );
          }

          if (part.removed) {
            return (
              <span
                key={index}
                style={{
                  background: 'oklch(95% 0.05 30 / 0.5)',
                  color: 'oklch(38% 0.13 30)',
                  padding: '0 3px',
                  borderRadius: 3,
                  textDecoration: 'line-through',
                  textDecorationColor: 'oklch(60% 0.16 30 / 0.6)',
                  textDecorationThickness: '1px',
                }}
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
