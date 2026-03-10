import { Controller, Get, Post, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Post('reindex')
  @ApiOperation({ summary: 'Reindex all pages into MeiliSearch' })
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
