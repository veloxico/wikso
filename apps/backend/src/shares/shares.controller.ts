import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpacePermissionGuard } from '../common/guards/space-permission.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SharesService } from './shares.service';
import { CreateShareDto } from './dto/create-share.dto';
import { UpdateShareDto } from './dto/update-share.dto';

/**
 * Authenticated CRUD for guest share links. Mounted under
 * `/spaces/:slug/pages/:pageId/shares` so SpacePermissionGuard can authorise
 * against the parent space (EDITOR+ for writes, viewer+ for reads).
 */
@ApiTags('Shares')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SpacePermissionGuard)
@Controller('spaces/:slug/pages/:pageId/shares')
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @Get()
  @ApiOperation({ summary: 'List all share links for a page' })
  list(
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    return this.shares.listShares(pageId, slug);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new guest share link' })
  create(
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: CreateShareDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.shares.createShare(pageId, slug, user.id, dto);
  }

  @Patch(':shareId')
  @ApiOperation({ summary: 'Update share settings (expiry, password, comments)' })
  update(
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('shareId', ParseUUIDPipe) shareId: string,
    @Body() dto: UpdateShareDto,
  ) {
    return this.shares.updateShare(shareId, pageId, slug, dto);
  }

  @Delete(':shareId')
  @ApiOperation({ summary: 'Revoke a share link (soft delete)' })
  revoke(
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('shareId', ParseUUIDPipe) shareId: string,
  ) {
    return this.shares.revokeShare(shareId, pageId, slug);
  }
}
