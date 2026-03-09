'use client';

import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalloutType } from './CalloutExtension';

const CALLOUT_CONFIG: Record<
  CalloutType,
  {
    icon: typeof Info;
    bgClass: string;
    borderClass: string;
    iconClass: string;
  }
> = {
  info: {
    icon: Info,
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    borderClass: 'border-blue-200 dark:border-blue-800',
    iconClass: 'text-blue-500',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    borderClass: 'border-amber-200 dark:border-amber-800',
    iconClass: 'text-amber-500',
  },
  success: {
    icon: CheckCircle,
    bgClass: 'bg-green-50 dark:bg-green-950/30',
    borderClass: 'border-green-200 dark:border-green-800',
    iconClass: 'text-green-500',
  },
  error: {
    icon: XCircle,
    bgClass: 'bg-red-50 dark:bg-red-950/30',
    borderClass: 'border-red-200 dark:border-red-800',
    iconClass: 'text-red-500',
  },
};

const TYPES: CalloutType[] = ['info', 'warning', 'success', 'error'];

export function CalloutView(props: any) {
  const type: CalloutType = props.node.attrs.type || 'info';
  const config = CALLOUT_CONFIG[type];
  const Icon = config.icon;

  const cycleType = () => {
    if (!props.editor.isEditable) return;
    const currentIdx = TYPES.indexOf(type);
    const nextType = TYPES[(currentIdx + 1) % TYPES.length];
    props.updateAttributes({ type: nextType });
  };

  return (
    <NodeViewWrapper
      className={cn(
        'callout my-3 rounded-lg border-l-4 p-4',
        config.bgClass,
        config.borderClass,
      )}
      data-callout=""
      data-callout-type={type}
    >
      <div className="flex gap-3">
        <button
          type="button"
          className={cn(
            'mt-0.5 shrink-0 cursor-pointer transition-transform hover:scale-110',
            config.iconClass,
          )}
          onClick={cycleType}
          title="Click to change type"
          contentEditable={false}
        >
          <Icon className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <NodeViewContent className="callout-content" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
