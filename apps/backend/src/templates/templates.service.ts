import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(spaceId?: string) {
    const where: any = {};

    if (spaceId) {
      // Return global defaults + templates belonging to the given space
      where.OR = [{ isDefault: true, spaceId: null }, { spaceId }];
    }
    // When no spaceId is provided, return all templates (defaults + space-specific)

    return this.prisma.pageTemplate.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: [{ isDefault: 'desc' }, { title: 'asc' }],
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        space: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findById(id: string) {
    const template = await this.prisma.pageTemplate.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        space: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async create(dto: CreateTemplateDto, userId: string) {
    return this.prisma.pageTemplate.create({
      data: {
        title: dto.title,
        description: dto.description,
        contentJson: dto.contentJson,
        category: dto.category || 'General',
        icon: dto.icon,
        spaceId: dto.spaceId || null,
        creatorId: userId,
      },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        space: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const existing = await this.prisma.pageTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Template not found');

    return this.prisma.pageTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.contentJson !== undefined && { contentJson: dto.contentJson as any }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.spaceId !== undefined && { spaceId: dto.spaceId }),
      },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        space: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.pageTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Template not found');

    await this.prisma.pageTemplate.delete({ where: { id } });
    return { message: 'Template deleted' };
  }

  async seedDefaults() {
    const existingDefaults = await this.prisma.pageTemplate.count({
      where: { isDefault: true },
    });

    if (existingDefaults > 0) {
      this.logger.log('Default templates already exist, skipping seed');
      return;
    }

    this.logger.log('Seeding default templates...');

    const defaults = [
      {
        title: 'Blank Page',
        description: 'Start from scratch with an empty page',
        icon: 'file-text',
        category: 'General',
        contentJson: {
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
        title: 'Meeting Notes',
        description: 'Capture meeting details, attendees, and action items',
        icon: 'users',
        category: 'Meetings',
        contentJson: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Date' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Attendees' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Agenda' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Notes' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Action Items' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
          ],
        },
      },
      {
        title: 'Technical Design',
        description: 'Document technical architecture and design decisions',
        icon: 'code',
        category: 'Engineering',
        contentJson: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Overview' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Architecture' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'API Design' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Data Model' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Testing' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
          ],
        },
      },
      {
        title: 'How-to Guide',
        description: 'Step-by-step instructions for completing a task',
        icon: 'book-open',
        category: 'Documentation',
        contentJson: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Prerequisites' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Steps' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Troubleshooting' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
          ],
        },
      },
      {
        title: 'Decision Log',
        description: 'Record decisions, their context, and consequences',
        icon: 'git-branch',
        category: 'Planning',
        contentJson: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Context' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Options' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Decision' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Consequences' }],
            },
            {
              type: 'paragraph',
              content: [],
            },
          ],
        },
      },
    ];

    for (const template of defaults) {
      await this.prisma.pageTemplate.create({
        data: {
          ...template,
          isDefault: true,
        },
      });
    }

    this.logger.log(`Seeded ${defaults.length} default templates`);
  }
}
