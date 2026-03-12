import { Controller, Get, Post, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GlobalRole } from '@prisma/client';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Post('reindex')
  @UseGuards(RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Reindex all pages into MeiliSearch (admin only)' })
  reindex() {
    return this.searchService.reindexAll();
  }

  @Get('global')
  @ApiOperation({ summary: 'Global search across pages and spaces' })
  searchGlobal(@Query('q') q: string, @Req() req: any) {
    return this.searchService.searchGlobal(q, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Search pages' })
  search(
    @Query('q') q: string,
    @Query('spaceId') spaceId?: string,
    @Query('authorId') authorId?: string,
    @Query('tags') tags?: string,
  ) {
    return this.searchService.search(q, { spaceId, authorId, tags });
  }
}
