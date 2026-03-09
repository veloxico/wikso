import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpacePermissionGuard } from '../common/guards/space-permission.guard';
import { CreateTagDto } from './dto/create-tag.dto';

@ApiTags('Tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('spaces/:slug/tags')
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Get()
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'List tags in a space' })
  list(@Param('slug') slug: string) {
    return this.tagsService.list(slug);
  }

  @Post()
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Create a tag' })
  create(@Param('slug') slug: string, @Body() dto: CreateTagDto) {
    return this.tagsService.create(slug, dto.name);
  }

  @Delete(':tagId')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Delete a tag' })
  delete(@Param('tagId') tagId: string) {
    return this.tagsService.delete(tagId);
  }

  @Post(':pageId/tag/:tagId')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Add tag to page' })
  addTag(@Param('pageId') pageId: string, @Param('tagId') tagId: string) {
    return this.tagsService.addTagToPage(pageId, tagId);
  }

  @Delete(':pageId/tag/:tagId')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Remove tag from page' })
  removeTag(@Param('pageId') pageId: string, @Param('tagId') tagId: string) {
    return this.tagsService.removeTagFromPage(pageId, tagId);
  }

  @Get('by-tag/:tagId/pages')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Get pages by tag' })
  pagesByTag(@Param('slug') slug: string, @Param('tagId') tagId: string) {
    return this.tagsService.getPagesByTag(slug, tagId);
  }
}
