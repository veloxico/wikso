import { Controller, Get, Post, Delete, Param, Res, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { Readable } from 'stream';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtOrQueryAuthGuard } from '../auth/guards/jwt-or-query-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Attachments')
@Controller()
export class AttachmentsController {
  constructor(private attachmentsService: AttachmentsService) {}

  @Post('pages/:pageId/attachments')
  @ApiOperation({ summary: 'Upload attachment' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findByPage(@Param('pageId') pageId: string) {
    return this.attachmentsService.findByPage(pageId);
  }

  @Delete('attachments/:id')
  @ApiOperation({ summary: 'Delete attachment' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.attachmentsService.delete(id, user.id);
  }

  @Get('attachments/:id/download')
  @ApiOperation({ summary: 'Get download URL (signed, expires in 1h)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  download(@Param('id') id: string) {
    return this.attachmentsService.getDownloadUrl(id);
  }

  /**
   * Permanent file proxy — streams file content directly from S3.
   * Public endpoint — attachment UUIDs are unguessable and serve as
   * capability tokens. This avoids auth issues with browser-initiated
   * requests (<img src>, <video src>, CSS url(), etc.).
   */
  @Get('attachments/:id/file')
  @ApiOperation({ summary: 'Stream file content (public, UUID acts as capability token)' })
  async file(@Param('id') id: string, @Res() res: any) {
    const { stream, mimeType, filename, size } = await this.attachmentsService.getFileStream(id);

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'private, max-age=3600',
      'Referrer-Policy': 'no-referrer',
    });

    if (size) {
      res.set('Content-Length', String(size));
    }

    if (stream instanceof Readable) {
      stream.pipe(res);
    } else if (stream && typeof (stream as any).transformToByteArray === 'function') {
      const bytes = await (stream as any).transformToByteArray();
      res.send(Buffer.from(bytes));
    } else {
      res.status(404).send('File not found');
    }
  }
}
