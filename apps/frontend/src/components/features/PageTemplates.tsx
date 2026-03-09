'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Lightbulb, Users, CheckSquare2, ArrowRight, Zap, Search, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { api } from '@/lib/api';

interface PageTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (content: object) => void;
  spaceId?: string;
}

interface Template {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  content: object;
  category?: string;
}

const categoryIcons: Record<string, React.ElementType> = {
  General: FileText,
  Planning: Lightbulb,
  Documentation: BookOpen,
  Team: Users,
};

export function PageTemplatesDialog({
  open,
  onOpenChange,
  onSelect,
  spaceId,
}: PageTemplatesDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  // Fetch backend templates
  const { data: backendTemplates } = useQuery<any[]>({
    queryKey: ['templates', spaceId],
    queryFn: async () => {
      const url = spaceId ? `/templates?spaceId=${spaceId}` : '/templates';
      const { data } = await api.get(url);
      return data;
    },
    enabled: open,
  });

  // TipTap JSON content templates (local fallback)
  const localTemplates: Template[] = [
    {
      id: 'blank',
      icon: <Zap className="h-6 w-6" />,
      title: t('templates.blank'),
      description: t('templates.blankDesc'),
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [],
          },
        ],
      },
    },
    {
      id: 'meeting-notes',
      icon: <BookOpen className="h-6 w-6" />,
      title: t('templates.meetingNotes'),
      description: t('templates.meetingNotesDesc'),
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Meeting Title' }],
          },
          {
            type: 'paragraph',
            content: [],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Date' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Attendees' }],
          },
          {
            type: 'bullet_list',
            content: [
              {
                type: 'list_item',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Agenda' }],
          },
          {
            type: 'bullet_list',
            content: [
              {
                type: 'list_item',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Discussion' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Action Items' }],
          },
          {
            type: 'task_list',
            content: [
              {
                type: 'task_item',
                attrs: { checked: false },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Next Steps' }],
          },
          {
            type: 'bullet_list',
            content: [
              {
                type: 'list_item',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      id: 'technical-spec',
      icon: <Lightbulb className="h-6 w-6" />,
      title: t('templates.technicalSpec'),
      description: t('templates.technicalSpecDesc'),
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Technical Specification' }],
          },
          {
            type: 'paragraph',
            content: [],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Overview' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Goals' }],
          },
          {
            type: 'bullet_list',
            content: [
              {
                type: 'list_item',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Non-Goals' }],
          },
          {
            type: 'bullet_list',
            content: [
              {
                type: 'list_item',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Technical Design' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'API Changes' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Testing Strategy' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Timeline' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
        ],
      },
    },
    {
      id: 'onboarding-guide',
      icon: <Users className="h-6 w-6" />,
      title: t('templates.onboardingGuide'),
      description: t('templates.onboardingGuideDesc'),
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Onboarding Guide' }],
          },
          {
            type: 'paragraph',
            content: [],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Welcome' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Welcome to the team! This guide will help you get started.' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Prerequisites' }],
          },
          {
            type: 'bullet_list',
            content: [
              {
                type: 'list_item',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Getting Started' }],
          },
          {
            type: 'ordered_list',
            content: [
              {
                type: 'list_item',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Key Resources' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'table_row',
                content: [
                  {
                    type: 'table_header',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Resource' }],
                      },
                    ],
                  },
                  {
                    type: 'table_header',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Link' }],
                      },
                    ],
                  },
                  {
                    type: 'table_header',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Description' }],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'table_row',
                content: [
                  {
                    type: 'table_cell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'table_cell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'table_cell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'FAQ' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
        ],
      },
    },
    {
      id: 'decision-record',
      icon: <CheckSquare2 className="h-6 w-6" />,
      title: t('templates.decisionRecord'),
      description: t('templates.decisionRecordDesc'),
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Decision Record' }],
          },
          {
            type: 'paragraph',
            content: [],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Status' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Proposed | Accepted | Deprecated | Superseded' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Context' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Decision' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Consequences' }],
          },
          {
            type: 'bullet_list',
            content: [
              {
                type: 'list_item',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Participants' }],
          },
          {
            type: 'bullet_list',
            content: [
              {
                type: 'list_item',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      id: 'retrospective',
      icon: <ArrowRight className="h-6 w-6" />,
      title: t('templates.retrospective'),
      description: t('templates.retrospectiveDesc'),
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Retrospective' }],
          },
          {
            type: 'paragraph',
            content: [],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Sprint/Period' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'What Went Well' }],
          },
          {
            type: 'bullet_list',
            content: [
              {
                type: 'list_item',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'What Could Improve' }],
          },
          {
            type: 'bullet_list',
            content: [
              {
                type: 'list_item',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Action Items' }],
          },
          {
            type: 'task_list',
            content: [
              {
                type: 'task_item',
                attrs: { checked: false },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ];

  // Merge backend templates with local templates
  const allTemplates = useMemo(() => {
    const result: Template[] = [...localTemplates];

    if (backendTemplates) {
      for (const bt of backendTemplates) {
        // Skip if we already have a local template with same id
        if (result.some((t) => t.id === bt.id)) continue;
        const CategoryIcon = categoryIcons[bt.category] || FileText;
        result.push({
          id: bt.id,
          icon: bt.icon ? <span className="text-xl">{bt.icon}</span> : <CategoryIcon className="h-6 w-6" />,
          title: bt.title,
          description: bt.description || '',
          content: bt.contentJson,
          category: bt.category,
        });
      }
    }

    return result;
  }, [localTemplates, backendTemplates]);

  // Filter by search
  const filteredTemplates = useMemo(() => {
    if (!search) return allTemplates;
    const query = search.toLowerCase();
    return allTemplates.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        (t.category && t.category.toLowerCase().includes(query)),
    );
  }, [allTemplates, search]);

  const handleSelect = (template: Template) => {
    onSelect(template.content);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('templates.title')}</DialogTitle>
          <DialogDescription>{t('templates.chooseTemplate')}</DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('templates.searchPlaceholder') || 'Search templates...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="relative group rounded-lg border border-border p-4 hover:border-border/80 hover:shadow-md transition-all cursor-pointer"
              onClick={() => handleSelect(template)}
            >
              <div className="flex items-start gap-3 mb-2">
                <div className="text-muted-foreground mt-0.5">
                  {template.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">
                    {template.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {template.description}
                  </p>
                  {template.category && (
                    <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 bg-muted px-2 py-0.5 rounded">
                      {template.category}
                    </span>
                  )}
                </div>
              </div>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(template);
                  }}
                >
                  {t('common.add')}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}

          {filteredTemplates.length === 0 && (
            <div className="col-span-2 text-center py-8">
              <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {t('templates.noResults') || 'No templates match your search'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
