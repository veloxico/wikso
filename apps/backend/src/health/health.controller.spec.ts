import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock; isReady: boolean };
  let redis: { getClient: jest.Mock };

  beforeEach(async () => {
    // `isReady` is set to true by default — the controller returns
    // `setup_required` when Prisma hasn't bootstrapped yet (first install,
    // auto-migration in flight). Tests that exercise that state flip it off.
    prisma = {
      $queryRaw: jest.fn(),
      isReady: true,
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

  describe('check (public)', () => {
    it('should return ok when database is up', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result).not.toHaveProperty('checks');
      expect(result).not.toHaveProperty('version');
    });

    it('should return degraded when database is down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await controller.check();

      expect(result.status).toBe('degraded');
    });

    it('should return setup_required when Prisma is not ready (first boot / auto-migration)', async () => {
      prisma.isReady = false;

      const result = await controller.check();

      expect(result.status).toBe('setup_required');
      // Must NOT query the DB when we already know the client isn't ready —
      // otherwise startup logs get spammed with connection errors.
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('detailedCheck (admin)', () => {
    it('should return detailed info when all services are up', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.detailedCheck();

      expect(result.status).toBe('ok');
      expect(result.checks.database.status).toBe('up');
      expect(result.checks.redis.status).toBe('up');
      expect(result.checks.meilisearch.status).toBe('up');
      expect(result.timestamp).toBeDefined();
      expect(result.version).toBeDefined();
    });

    it('should return degraded when database is down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await controller.detailedCheck();

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

      const result = await controller.detailedCheck();

      expect(result.status).toBe('degraded');
      expect(result.checks.redis.status).toBe('down');
      expect(result.checks.redis.message).toBe('Redis unavailable');
    });

    it('should return degraded when all services are down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      redis.getClient.mockReturnValue({
        ping: jest.fn().mockRejectedValue(new Error('Redis down')),
      });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Meili down'));

      const result = await controller.detailedCheck();

      expect(result.status).toBe('degraded');
      expect(result.checks.database.status).toBe('down');
      expect(result.checks.redis.status).toBe('down');
      expect(result.checks.meilisearch.status).toBe('down');
    });
  });
});
