'use client';

import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { CalloutType } from './CalloutExtension';

/**
 * CalloutView — renders the TipTap `callout` node as a warm-paper
 * `.wp-callout` block. The previous iteration used generic Tailwind
 * palettes (`bg-blue-50`, `border-amber-200`…) that fought the
 * warm-paper OKLCH tokens — the greens looked neon next to Source
 * Serif 4 body text, and the whole thing broke when the user switched
 * to the moss / plum accent.
 *
 * The new rendering delegates ALL coloring to the `.wp-callout` CSS
 * primitive in globals.css (scoped by `data-callout-type`). Each type
 * gets its own hue + chroma; dark mode rebalances in the same rule.
 * The wrapping React node is now just structural — `.wp-callout-stamp`
 * for the icon slot and `.wp-callout-body` for the editable content.
 *
 * The stamp is a button that cycles types in-order (note → tip → warn
 * → decision → note) when the editor is editable. Icons and the cycle
 * order are unchanged — what changed is the visual language.
 */

const CONFIG: Record<CalloutType, { icon: typeof Info }> = {
  info: { icon: Info },
  warning: { icon: AlertTriangle },
  success: { icon: CheckCircle },
  error: { icon: XCircle },
};

const TYPES: CalloutType[] = ['info', 'warning', 'success', 'error'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CalloutView(props: any) {
  const type: CalloutType = props.node.attrs.type || 'info';
  const Icon = CONFIG[type].icon;

  const cycleType = () => {
    if (!props.editor.isEditable) return;
    const currentIdx = TYPES.indexOf(type);
    const nextType = TYPES[(currentIdx + 1) % TYPES.length];
    props.updateAttributes({ type: nextType });
  };

  return (
    <NodeViewWrapper
      className="wp-callout"
      data-callout=""
      data-callout-type={type}
    >
      <button
        type="button"
        className="wp-callout-stamp"
        onClick={cycleType}
        title="Click to change type"
        contentEditable={false}
        aria-label={`Callout type: ${type}. Click to cycle.`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>
      {/* `min-width: 0` is set on `.wp-callout-body` in CSS; it's
          required for the grid `1fr` column to allow text-wrap.
          The `flex-1` Tailwind class was a leftover from the old
          flex layout and is dead in the new grid context. */}
      <div className="wp-callout-body">
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
}
