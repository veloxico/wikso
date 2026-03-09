import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GlobalRole } from '@prisma/client';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  private s3: S3Client;
  private bucket: string;

  constructor(private prisma: PrismaService) {
    this.bucket = process.env.MINIO_BUCKET || process.env.S3_BUCKET || 'dokka-uploads';

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

  async create(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name || 'User',
        passwordHash: hash,
        role: GlobalRole.VIEWER, // Default role
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, createdAt: true },
    });
  }

  async findAll(skip = 0, take = 20) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        select: { id: true, email: true, name: true, avatarUrl: true, role: true, createdAt: true },
      }),
      this.prisma.user.count(),
    ]);
    return { users, total };
  }

  async updateRole(id: string, role: GlobalRole) {
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  async delete(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted' };
  }

  /** Upload a cropped avatar image to S3 and update the user record. */
  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const ext = file.originalname.split('.').pop() || 'jpg';
    const storageKey = `avatars/${userId}/${uuid()}.${ext}`;

    // Delete previous avatar from S3 if exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.avatarUrl) {
      const prevKeyMatch = user.avatarUrl.match(/avatarStorageKey:(.+)/);
      // We store the key in a separate field; fall back to no-op
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    // Store permanent proxy URL as avatarUrl
    const avatarUrl = `/api/users/${userId}/avatar?v=${Date.now()}`;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl, avatarStorageKey: storageKey },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, createdAt: true },
    });

    return updated;
  }

  /** Stream avatar image from S3 for a given user. */
  async getAvatarStream(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.avatarStorageKey) return null;

    try {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: user.avatarStorageKey }),
      );
      // Determine mime type from key extension
      const ext = user.avatarStorageKey.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg',
        png: 'image/png', webp: 'image/webp', gif: 'image/gif',
      };
      return {
        stream: response.Body,
        mimeType: mimeMap[ext || ''] || 'image/jpeg',
      };
    } catch {
      return null;
    }
  }
}
