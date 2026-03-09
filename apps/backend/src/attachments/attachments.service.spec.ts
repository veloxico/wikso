import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock S3 Client
jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn().mockResolvedValue({});
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    HeadBucketCommand: jest.fn(),
    CreateBucketCommand: jest.fn(),
    __mockSend: mockSend,
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com/file'),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let prisma: any;

  const mockPrisma = {
    attachment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
    prisma = module.get(PrismaService);
  });

  describe('upload', () => {
    it('should upload a file to S3 and create attachment record', async () => {
      const mockFile = {
        originalname: 'test-image.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const expectedAttachment = {
        id: 'att-1',
        pageId: 'page-1',
        uploaderId: 'user-1',
        filename: 'test-image.png',
        mimeType: 'image/png',
        size: 1024,
        storageKey: 'page-1/mock-uuid-1234-test-image.png',
      };

      mockPrisma.attachment.create.mockResolvedValue(expectedAttachment);

      const result = await service.upload('page-1', 'user-1', mockFile);

      expect(result).toEqual(expectedAttachment);
      expect(mockPrisma.attachment.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          uploaderId: 'user-1',
          filename: 'test-image.png',
          mimeType: 'image/png',
          size: 1024,
          storageKey: 'page-1/mock-uuid-1234-test-image.png',
        },
      });
    });
  });

  describe('findByPage', () => {
    it('should return all attachments for a page', async () => {
      const attachments = [
        { id: 'att-1', pageId: 'page-1', filename: 'file1.png' },
        { id: 'att-2', pageId: 'page-1', filename: 'file2.pdf' },
      ];

      mockPrisma.attachment.findMany.mockResolvedValue(attachments);

      const result = await service.findByPage('page-1');

      expect(result).toEqual(attachments);
      expect(mockPrisma.attachment.findMany).toHaveBeenCalledWith({
        where: { pageId: 'page-1' },
      });
    });

    it('should return empty array when no attachments', async () => {
      mockPrisma.attachment.findMany.mockResolvedValue([]);

      const result = await service.findByPage('page-1');

      expect(result).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete attachment from S3 and database', async () => {
      const attachment = {
        id: 'att-1',
        storageKey: 'page-1/uuid-file.png',
      };

      mockPrisma.attachment.findUnique.mockResolvedValue(attachment);
      mockPrisma.attachment.delete.mockResolvedValue(attachment);

      const result = await service.delete('att-1');

      expect(result).toEqual({ message: 'Attachment deleted' });
      expect(mockPrisma.attachment.findUnique).toHaveBeenCalledWith({
        where: { id: 'att-1' },
      });
      expect(mockPrisma.attachment.delete).toHaveBeenCalledWith({
        where: { id: 'att-1' },
      });
    });

    it('should throw NotFoundException when attachment does not exist', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('should return a presigned download URL', async () => {
      const attachment = {
        id: 'att-1',
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        storageKey: 'page-1/uuid-report.pdf',
      };

      mockPrisma.attachment.findUnique.mockResolvedValue(attachment);

      const result = await service.getDownloadUrl('att-1');

      expect(result).toEqual({
        url: 'https://mock-presigned-url.com/file',
        filename: 'report.pdf',
        mimeType: 'application/pdf',
      });
    });

    it('should throw NotFoundException when attachment does not exist', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(null);

      await expect(service.getDownloadUrl('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
