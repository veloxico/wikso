import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpacePermissionGuard } from '../common/guards/space-permission.guard';
import { PageAnalyticsService } from './page-analytics.service';

/**
 * Per-page analytics. Read-only: SpacePermissionGuard already grants this to
 * any space VIEWER+; we deliberately keep it that way so authors can see who
 * (in aggregate) is reading their work.
 */
@ApiTags('Page Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SpacePermissionGuard)
@Controller('spaces/:slug/pages/:pageId/analytics')
export class PageAnalyticsController {
  constructor(private readonly analytics: PageAnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'View counts and trend for the page' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  getStats(
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Query('period') period?: string,
  ) {
    return this.analytics.getStats(pageId, slug, period || '30d');
  }
}
