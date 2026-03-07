import { Controller, Get, Post, Delete, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AttachmentsController {
  constructor(private attachmentsService: AttachmentsService) {}

  @Post('pages/:pageId/attachments')
  @ApiOperation({ summary: 'Upload attachment' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('pageId') pageId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.attachmentsService.upload(pageId, user.id, file);
  }

  @Get('pages/:pageId/attachments')
  @ApiOperation({ summary: 'List attachments for a page' })
  findByPage(@Param('pageId') pageId: string) {
    return this.attachmentsService.findByPage(pageId);
  }

  @Delete('attachments/:id')
  @ApiOperation({ summary: 'Delete attachment' })
  remove(@Param('id') id: string) {
    return this.attachmentsService.delete(id);
  }

  @Get('attachments/:id/download')
  @ApiOperation({ summary: 'Get download URL' })
  download(@Param('id') id: string) {
    return this.attachmentsService.getDownloadUrl(id);
  }
}
