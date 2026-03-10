import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GlobalRole } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuid } from 'uuid';

@ApiTags('Admin - Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@Controller('admin/import')
export class ImportController {
  constructor(
    @InjectQueue('confluence-import') private importQueue: Queue,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a Confluence export ZIP for import' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'application/zip' ||
          file.mimetype === 'application/x-zip-compressed' ||
          file.mimetype === 'application/octet-stream' ||
          file.originalname.endsWith('.zip')
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only ZIP files are allowed'), false);
        }
      },
    }),
  )
  async uploadAndImport(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Save the uploaded file to a temp path
    const tmpDir = path.join(os.tmpdir(), 'wikso-import-uploads');
    fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, `${uuid()}.zip`);
    fs.writeFileSync(zipPath, file.buffer);

    // Enqueue the import job
    const job = await this.importQueue.add(
      'import',
      {
        zipPath,
        adminUserId: req.user.id,
      },
      {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    return {
      jobId: job.id,
      message: 'Import started. Use the status endpoint to track progress.',
    };
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Get import job status and progress' })
  async getImportStatus(@Param('jobId') jobId: string) {
    const job = await this.importQueue.getJob(jobId);

    if (!job) {
      throw new BadRequestException('Import job not found');
    }

    const state = await job.getState();
    const progress = (job.progress as any) || {
      phase: 'uploading',
      percent: 0,
      counts: { spaces: 0, pages: 0, attachments: 0, comments: 0, tags: 0 },
      errors: [],
    };

    return {
      jobId: job.id,
      state,
      ...progress,
    };
  }
}
