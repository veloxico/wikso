import { Injectable, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AttachmentsService implements OnModuleInit {
  private s3: S3Client;
  private bucket: string;

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {
    this.bucket = process.env.MINIO_BUCKET || process.env.S3_BUCKET || 'attachments';

    const useSsl = process.env.MINIO_USE_SSL === 'true' || process.env.S3_USE_SSL === 'true';
    const rawEndpoint = process.env.MINIO_ENDPOINT || process.env.S3_ENDPOINT;
    let host = 'localhost';
    let port = process.env.MINIO_PORT || process.env.S3_PORT || '9000';

    if (rawEndpoint) {
      try {
        const url = new URL(rawEndpoint.startsWith('http') ? rawEndpoint : `http://${rawEndpoint}`);
        host = url.hostname;
        port = url.port || port;
      } catch {
        host = rawEndpoint.replace(/^https?:\/\//, '').split(':')[0] || host;
      }
    }

    this.s3 = new S3Client({
      endpoint: `http${useSsl ? 's' : ''}://${host}:${port}`,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || process.env.S3_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async upload(pageId: string, uploaderId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    // Enforce configurable file size limit from admin settings (hard cap 100 MB)
    const settings = await this.settingsService.getSettings();
    const maxBytes = Math.min(settings.maxAttachmentSizeMb, 100) * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds the maximum allowed size (${settings.maxAttachmentSizeMb} MB)`,
      );
    }

    const storageKey = `${pageId}/${uuid()}-${file.originalname}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return this.prisma.attachment.create({
      data: {
        pageId,
        uploaderId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey,
      },
    });
  }

  async findByPage(pageId: string) {
    return this.prisma.attachment.findMany({ where: { pageId } });
  }

  async delete(id: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.uploaderId !== userId) {
      throw new ForbiddenException('You can only delete your own attachments');
    }

    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: attachment.storageKey }),
    );

    await this.prisma.attachment.delete({ where: { id } });
    return { message: 'Attachment deleted' };
  }

  async getDownloadUrl(id: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: attachment.storageKey }),
      { expiresIn: 3600 },
    );

    return { url, filename: attachment.filename, mimeType: attachment.mimeType };
  }

  /**
   * Stream file content directly from S3.
   * Returns the S3 response body (readable stream), content type, and filename.
   * This is used for permanent URLs that don't expire (unlike signed URLs).
   */
  async getFileStream(id: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: attachment.storageKey }),
    );

    return {
      stream: response.Body,
      mimeType: attachment.mimeType,
      filename: attachment.filename,
      size: attachment.size,
    };
  }
}
