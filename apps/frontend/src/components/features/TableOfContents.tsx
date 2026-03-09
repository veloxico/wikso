'use client';

import { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { useTranslation } from '@/hooks/useTranslation';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Heading {
  id: string;
  level: number;
  text: string;
  element?: HTMLElement;
}

interface TableOfContentsProps {
  editor: Editor | null;
}

export function TableOfContents({ editor }: TableOfContentsProps) {
  const { t } = useTranslation();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Extract headings from editor
  useEffect(() => {
    if (!editor) {
      setHeadings([]);
      return;
    }

    const extractHeadings = () => {
      const json = editor.getJSON();
      const extractedHeadings: Heading[] = [];
      let headingIndex = 0;

      const traverse = (node: any) => {
        if (
          node.type === 'heading' &&
          node.content &&
          node.content.length > 0
        ) {
          const text = node.content
            .map((n: any) => n.text || '')
            .join('')
            .trim();

          if (text) {
            const level = parseInt(node.attrs?.level || '1');
            const id = `heading-${headingIndex}`;
            headingIndex++;

            extractedHeadings.push({
              id,
              level,
              text,
            });
          }
        }

        if (node.content && Array.isArray(node.content)) {
          node.content.forEach(traverse);
        }
      };

      if (json.content) {
        json.content.forEach(traverse);
      }

      setHeadings(extractedHeadings);
    };

    extractHeadings();

    editor.on('update', extractHeadings);
    return () => {
      editor.off('update', extractHeadings);
    };
  }, [editor]);

  // Setup intersection observer for active heading
  useEffect(() => {
    if (headings.length === 0) return;

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      let activeId: string | null = null;

      // Find the heading that is most visible on screen
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          if (id.startsWith('toc-heading-')) {
            activeId = id.replace('toc-heading-', '');
          }
        }
      });

      if (activeId) {
        setActiveHeading(activeId);
      }
    };

    observerRef.current = new IntersectionObserver(observerCallback, {
      rootMargin: '-50% 0px -50% 0px',
      threshold: 0,
    });

    // Find all heading elements in the editor and observe them
    const editorElement = editor?.view.dom;
    if (editorElement) {
      const editorHeadings = editorElement.querySelectorAll('h1, h2, h3');
      editorHeadings.forEach((element, index) => {
        element.id = `toc-heading-${index}`;
        observerRef.current?.observe(element);
      });
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [headings, editor]);

  const scrollToHeading = (index: number) => {
    const editorElement = editor?.view.dom;
    if (editorElement) {
      const headingElement = editorElement.querySelector(
        `#toc-heading-${index}`
      );
      if (headingElement) {
        headingElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Update active heading
        const headingIndex = parseInt(
          headingElement.id.replace('toc-heading-', '')
        );
        setActiveHeading(String(headingIndex));
      }
    }
  };

  if (isMobile && headings.length > 0) {
    return null; // Hide on mobile
  }

  const renderHeadings = () => {
    if (headings.length === 0) {
      return (
        <div className="text-sm text-muted-foreground italic px-2 py-2">
          {t('editor.noHeadings')}
        </div>
      );
    }

    return (
      <nav className="space-y-0">
        {headings.map((heading, index) => (
          <button
            key={heading.id}
            onClick={() => scrollToHeading(index)}
            className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-accent/50 rounded ${
              activeHeading === String(index)
                ? 'text-primary font-semibold bg-accent/30 border-l-2 border-primary'
                : 'text-muted-foreground'
            }`}
            style={{
              paddingLeft: `${(heading.level - 1) * 12 + 12}px`,
            }}
          >
            <span className="truncate block">{heading.text}</span>
          </button>
        ))}
      </nav>
    );
  };

  return (
    <aside className="fixed right-0 top-20 h-[calc(100vh-5rem)] w-64 border-l border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-y-auto z-40 hidden lg:block">
      <div className="sticky top-0 bg-background/95 border-b border-border p-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('editor.tableOfContents')}</h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-accent rounded"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-4">
          {renderHeadings()}
        </div>
      )}
    </aside>
  );
}
