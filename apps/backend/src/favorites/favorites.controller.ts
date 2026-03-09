import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List current user\'s favorites' })
  list(@CurrentUser() user: any) {
    return this.favoritesService.list(user.id);
  }

  @Post(':pageId')
  @ApiOperation({ summary: 'Toggle favorite for a page' })
  toggle(@Param('pageId') pageId: string, @CurrentUser() user: any) {
    return this.favoritesService.toggle(user.id, pageId);
  }

  @Delete(':pageId')
  @ApiOperation({ summary: 'Remove a page from favorites' })
  remove(@Param('pageId') pageId: string, @CurrentUser() user: any) {
    return this.favoritesService.remove(user.id, pageId);
  }

  @Get('check/:pageId')
  @ApiOperation({ summary: 'Check if a page is favorited' })
  check(@Param('pageId') pageId: string, @CurrentUser() user: any) {
    return this.favoritesService.check(user.id, pageId);
  }
}
