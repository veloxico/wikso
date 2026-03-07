import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

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
