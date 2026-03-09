'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Trash2,
} from 'lucide-react';

export function ResizableImageView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: NodeViewProps) {
  const { src, alt, width, alignment = 'center', caption = '' } = node.attrs;
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [currentWidth, setCurrentWidth] = useState<number | null>(null);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const captionRef = useRef<HTMLInputElement>(null);

  // Parse width value
  const parsedWidth = width
    ? typeof width === 'number'
      ? width
      : parseInt(String(width), 10) || null
    : null;

  useEffect(() => {
    if (parsedWidth) {
      setCurrentWidth(parsedWidth);
    }
  }, [parsedWidth]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: 'left' | 'right') => {
      e.preventDefault();
      e.stopPropagation();

      if (!imgRef.current || !editor.isEditable) return;

      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = imgRef.current.offsetWidth;
      const containerWidth = containerRef.current?.parentElement?.offsetWidth || 800;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const diff = direction === 'right'
          ? moveEvent.clientX - startX
          : startX - moveEvent.clientX;

        let newWidth = Math.max(100, startWidth + diff * 2); // *2 for centered resize
        newWidth = Math.min(newWidth, containerWidth);
        setCurrentWidth(Math.round(newWidth));
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        if (currentWidth) {
          updateAttributes({ width: currentWidth });
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [editor.isEditable, updateAttributes, currentWidth],
  );

  // Save width on resize end
  useEffect(() => {
    if (!isResizing && currentWidth && currentWidth !== parsedWidth) {
      updateAttributes({ width: currentWidth });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizing]);

  const handleCaptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAttributes({ caption: e.target.value });
    },
    [updateAttributes],
  );

  const handleCaptionKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setIsEditingCaption(false);
    }
  }, []);

  const alignmentClass =
    alignment === 'left'
      ? 'resizable-image-left'
      : alignment === 'right'
        ? 'resizable-image-right'
        : alignment === 'full'
          ? 'resizable-image-full'
          : 'resizable-image-center';

  return (
    <NodeViewWrapper
      className={`resizable-image-wrapper ${alignmentClass}`}
      data-drag-handle
    >
      <div
        ref={containerRef}
        className={`resizable-image-container ${selected ? 'selected' : ''}`}
        onMouseEnter={() => editor.isEditable && setShowToolbar(true)}
        onMouseLeave={() => !isResizing && setShowToolbar(false)}
      >
        {/* Floating toolbar */}
        {editor.isEditable && (showToolbar || selected) && (
          <div className="resizable-image-toolbar" contentEditable={false}>
            <button
              type="button"
              className={`toolbar-btn ${alignment === 'left' ? 'active' : ''}`}
              onClick={() => updateAttributes({ alignment: 'left' })}
              title="Align left"
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              className={`toolbar-btn ${alignment === 'center' ? 'active' : ''}`}
              onClick={() => updateAttributes({ alignment: 'center' })}
              title="Align center"
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              className={`toolbar-btn ${alignment === 'right' ? 'active' : ''}`}
              onClick={() => updateAttributes({ alignment: 'right' })}
              title="Align right"
            >
              <AlignRight size={14} />
            </button>
            <button
              type="button"
              className={`toolbar-btn ${alignment === 'full' ? 'active' : ''}`}
              onClick={() => updateAttributes({ alignment: 'full' })}
              title="Full width"
            >
              <Maximize2 size={14} />
            </button>
            <div className="toolbar-divider" />
            <button
              type="button"
              className="toolbar-btn toolbar-btn-danger"
              onClick={deleteNode}
              title="Delete image"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        {/* Image */}
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          className={`editor-image ${selected ? 'ProseMirror-selectednode' : ''}`}
          style={{
            width: currentWidth ? `${currentWidth}px` : alignment === 'full' ? '100%' : undefined,
            maxWidth: '100%',
          }}
          draggable={false}
        />

        {/* Resize handles */}
        {editor.isEditable && (showToolbar || selected) && (
          <>
            <div
              className="resize-handle resize-handle-left"
              onMouseDown={(e) => handleResizeStart(e, 'left')}
            >
              <div className="resize-handle-bar" />
            </div>
            <div
              className="resize-handle resize-handle-right"
              onMouseDown={(e) => handleResizeStart(e, 'right')}
            >
              <div className="resize-handle-bar" />
            </div>
          </>
        )}

        {/* Caption */}
        {editor.isEditable && (
          <div className="resizable-image-caption" contentEditable={false}>
            {isEditingCaption ? (
              <input
                ref={captionRef}
                type="text"
                value={caption || ''}
                onChange={handleCaptionChange}
                onKeyDown={handleCaptionKeyDown}
                onBlur={() => setIsEditingCaption(false)}
                placeholder="Add a caption..."
                className="caption-input"
                autoFocus
              />
            ) : (
              <span
                className={`caption-text ${!caption ? 'caption-placeholder' : ''}`}
                onClick={() => {
                  setIsEditingCaption(true);
                  setTimeout(() => captionRef.current?.focus(), 0);
                }}
              >
                {caption || 'Add a caption...'}
              </span>
            )}
          </div>
        )}

        {/* Read-only caption */}
        {!editor.isEditable && caption && (
          <div className="resizable-image-caption">
            <span className="caption-text">{caption}</span>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
