import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };
  let redis: { getClient: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
    };

    redis = {
      getClient: jest.fn().mockReturnValue({
        ping: jest.fn().mockResolvedValue('PONG'),
      }),
    };

    // Mock global fetch for Meilisearch health check
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return ok when all services are up', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.checks.database.status).toBe('up');
      expect(result.checks.redis.status).toBe('up');
      expect(result.checks.meilisearch.status).toBe('up');
      expect(result.timestamp).toBeDefined();
    });

    it('should return degraded when database is down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.checks.database.status).toBe('down');
      expect(result.checks.database.message).toBe('Connection refused');
      expect(result.checks.redis.status).toBe('up');
    });

    it('should return degraded when Redis is down', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      redis.getClient.mockReturnValue({
        ping: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
      });

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.checks.redis.status).toBe('down');
      expect(result.checks.redis.message).toBe('Redis unavailable');
    });

    it('should return degraded when Meilisearch is down', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Meilisearch timeout'));

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.checks.meilisearch.status).toBe('down');
      expect(result.checks.meilisearch.message).toBe('Meilisearch timeout');
    });

    it('should return degraded when all services are down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      redis.getClient.mockReturnValue({
        ping: jest.fn().mockRejectedValue(new Error('Redis down')),
      });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Meili down'));

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.checks.database.status).toBe('down');
      expect(result.checks.redis.status).toBe('down');
      expect(result.checks.meilisearch.status).toBe('down');
    });
  });
});
