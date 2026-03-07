import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpacePermissionGuard } from '../common/guards/space-permission.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { MovePageDto } from './dto/move-page.dto';

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
  @ApiOperation({ summary: 'Delete page' })
  remove(@Param('pageId') pageId: string) {
    return this.pagesService.delete(pageId);
  }

  @Patch(':pageId/move')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Move page' })
  move(@Param('pageId') pageId: string, @Body() dto: MovePageDto) {
    return this.pagesService.move(pageId, dto);
  }

  @Get(':pageId/versions')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Get page version history' })
  getVersions(@Param('pageId') pageId: string) {
    return this.pagesService.getVersions(pageId);
  }

  @Get(':pageId/versions/:versionId')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Get specific page version' })
  getVersion(@Param('pageId') pageId: string, @Param('versionId') versionId: string) {
    return this.pagesService.getVersion(pageId, versionId);
  }
}
