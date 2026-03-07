import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post('pages/:pageId/comments')
  @ApiOperation({ summary: 'Create a comment' })
  create(@Param('pageId') pageId: string, @Body() dto: CreateCommentDto, @CurrentUser() user: any) {
    return this.commentsService.create(pageId, dto, user.id);
  }

  @Get('pages/:pageId/comments')
  @ApiOperation({ summary: 'Get comments for a page' })
  findByPage(@Param('pageId') pageId: string) {
    return this.commentsService.findByPage(pageId);
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Update a comment' })
  update(@Param('id') id: string, @Body() dto: UpdateCommentDto, @CurrentUser() user: any) {
    return this.commentsService.update(id, dto, user.id);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete a comment' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.commentsService.delete(id, user.id, user.role === 'ADMIN');
  }
}
