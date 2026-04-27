import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpacePermissionGuard } from '../common/guards/space-permission.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PageWatchService } from './page-watch.service';

/**
 * Page-level subscription. Routed under the space slug so the
 * `SpacePermissionGuard` (VIEWER+) gates access — anonymous and
 * non-member users can never watch a page.
 */
@ApiTags('Page Watch')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SpacePermissionGuard)
@Controller('spaces/:slug/pages/:pageId/watch')
export class PageWatchController {
  constructor(private readonly watchService: PageWatchService) {}

  @Get()
  @ApiOperation({ summary: 'Am I watching this page? Plus total watcher count.' })
  status(
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.watchService.status(pageId, slug, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Subscribe to changes on this page' })
  watch(
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.watchService.watch(pageId, slug, user.id);
  }

  @Delete()
  @ApiOperation({ summary: 'Unsubscribe from changes on this page' })
  unwatch(
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.watchService.unwatch(pageId, slug, user.id);
  }
}
