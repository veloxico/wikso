import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GlobalRole } from '@prisma/client';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all templates (default + space-specific)' })
  findAll(@CurrentUser() user: any, @Query('spaceId') spaceId?: string) {
    return this.templatesService.findAll(user, spaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single template by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.templatesService.findById(id, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Create a new template' })
  create(@Body() dto: CreateTemplateDto, @CurrentUser() user: any) {
    return this.templatesService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Update a template' })
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Delete a template' })
  remove(@Param('id') id: string) {
    return this.templatesService.delete(id);
  }
}
