import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpacePermissionGuard } from '../common/guards/space-permission.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PageLinksService } from './page-links.service';

/**
 * Read-only "what links here" endpoint. Mounted under the same space-scoped
 * URL pattern as pages so SpacePermissionGuard handles target-space access;
 * the service additionally filters source pages by per-space visibility.
 */
@ApiTags('Backlinks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SpacePermissionGuard)
@Controller('spaces/:slug/pages/:pageId/backlinks')
export class PageLinksController {
  constructor(private readonly pageLinks: PageLinksService) {}

  @Get()
  @ApiOperation({ summary: 'List pages that link to this page (visible to caller only)' })
  list(
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @CurrentUser() user: { id: string; role?: string },
  ) {
    return this.pageLinks.getBacklinks(pageId, slug, user);
  }
}
