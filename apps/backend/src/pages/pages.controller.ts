import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpacePermissionGuard } from '../common/guards/space-permission.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { MovePageDto } from './dto/move-page.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Pages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('spaces/:slug/pages')
export class PagesController {
  constructor(private pagesService: PagesService) {}

  @Post()
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Create a page' })
  create(@Param('slug') slug: string, @Body() dto: CreatePageDto, @CurrentUser() user: any) {
    return this.pagesService.create(slug, dto, user.id);
  }

  @Get()
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Get page tree' })
  getTree(@Param('slug') slug: string) {
    return this.pagesService.getTree(slug);
  }

  @Get('popular')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Get popular pages' })
  getPopular(@Param('slug') slug: string, @Query('period') period?: string) {
    return this.pagesService.getPopular(slug, period || '7d');
  }

  @Get(':pageId')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Get page by ID' })
  findOne(@Param('pageId') pageId: string) {
    return this.pagesService.findById(pageId);
  }

  @Patch(':pageId')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Update page' })
  update(@Param('pageId') pageId: string, @Body() dto: UpdatePageDto, @CurrentUser() user: any) {
    return this.pagesService.update(pageId, dto, user.id);
  }

  @Delete(':pageId')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Move page to trash (soft delete)' })
  remove(@Param('pageId') pageId: string, @CurrentUser() user: any) {
    return this.pagesService.delete(pageId, user.id);
  }

  @Post(':pageId/duplicate')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Duplicate a page' })
  duplicate(@Param('pageId') pageId: string, @CurrentUser() user: any) {
    return this.pagesService.duplicate(pageId, user.id);
  }

  @Patch(':pageId/move')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Move page' })
  move(@Param('pageId') pageId: string, @Body() dto: MovePageDto) {
    return this.pagesService.move(pageId, dto);
  }

  @Get(':pageId/ancestors')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Get page ancestors (root → direct parent)' })
  getAncestors(@Param('pageId') pageId: string) {
    return this.pagesService.getAncestors(pageId);
  }

  @Get(':pageId/versions')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Get page version history (paginated)' })
  getVersions(@Param('pageId') pageId: string, @Query() pagination: PaginationDto) {
    return this.pagesService.getVersions(pageId, pagination.skip, pagination.take);
  }

  @Get(':pageId/versions/:versionId')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Get specific page version' })
  getVersion(@Param('pageId') pageId: string, @Param('versionId') versionId: string) {
    return this.pagesService.getVersion(pageId, versionId);
  }

  @Post(':pageId/versions/:versionId/restore')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Restore page to a specific version' })
  restoreVersion(
    @Param('pageId') pageId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: any,
  ) {
    return this.pagesService.restoreVersion(pageId, versionId, user.id);
  }
}
