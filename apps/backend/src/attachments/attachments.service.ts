import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

  constructor(private prisma: PrismaService) {
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

  async delete(id: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');

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
}
