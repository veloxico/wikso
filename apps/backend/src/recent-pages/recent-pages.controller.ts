import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RecentPagesService } from './recent-pages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Recent Pages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recent-pages')
export class RecentPagesController {
  constructor(private recentPagesService: RecentPagesService) {}

  @Get()
  @ApiOperation({ summary: 'List current user recent pages' })
  list(@CurrentUser() user: any) {
    return this.recentPagesService.list(user.id);
  }

  @Post(':pageId')
  @ApiOperation({ summary: 'Record a page visit' })
  recordVisit(@Param('pageId') pageId: string, @CurrentUser() user: any) {
    return this.recentPagesService.recordVisit(user.id, pageId);
  }
}
