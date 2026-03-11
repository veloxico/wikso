import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SpacesService } from './spaces.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpacePermissionGuard } from '../common/guards/space-permission.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { AddMemberDto } from './dto/add-member.dto';

@ApiTags('Spaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('spaces')
export class SpacesController {
  constructor(private spacesService: SpacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a space' })
  create(@Body() dto: CreateSpaceDto, @CurrentUser() user: any) {
    return this.spacesService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List accessible spaces' })
  findAll(@CurrentUser() user: any) {
    return this.spacesService.findAll(user.id);
  }

  @Get(':slug')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Get space by slug' })
  findOne(@Param('slug') slug: string) {
    return this.spacesService.findBySlug(slug);
  }

  @Patch(':slug')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Update space' })
  update(@Param('slug') slug: string, @Body() dto: UpdateSpaceDto) {
    return this.spacesService.update(slug, dto);
  }

  @Delete(':slug')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Delete space' })
  remove(@Param('slug') slug: string) {
    return this.spacesService.delete(slug);
  }

  @Get(':slug/members')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Get space members' })
  getMembers(@Param('slug') slug: string) {
    return this.spacesService.getMembers(slug);
  }

  @Get(':slug/members/search')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Search space members by name or email' })
  searchMembers(@Param('slug') slug: string, @Query('q') query: string) {
    return this.spacesService.searchMembers(slug, query || '');
  }

  @Post(':slug/members')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Add member (user or group) to space' })
  addMember(@Param('slug') slug: string, @Body() dto: AddMemberDto) {
    return this.spacesService.addMember(slug, dto);
  }

  @Delete(':slug/members/:userId')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Remove user member from space' })
  removeMember(@Param('slug') slug: string, @Param('userId') userId: string) {
    return this.spacesService.removeMember(slug, userId);
  }

  @Delete(':slug/members/group/:groupId')
  @UseGuards(SpacePermissionGuard)
  @ApiOperation({ summary: 'Remove group from space' })
  removeGroupMember(@Param('slug') slug: string, @Param('groupId') groupId: string) {
    return this.spacesService.removeGroupMember(slug, groupId);
  }
}
