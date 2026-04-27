import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;
  private logger = new Logger(RedisService.name);

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 200, 3000);
      },
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis connection error: ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });
  }

  async onModuleDestroy() {
    this.client.removeAllListeners();
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Delete all keys matching a glob pattern (e.g. "cache:spaces:*").
   * Uses SCAN + DEL in batches; safe for production (non-blocking).
   * Returns the number of keys deleted.
   */
  async delPattern(pattern: string): Promise<number> {
    let count = 0;
    const stream = this.client.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream as AsyncIterable<string[]>) {
      if (keys.length > 0) {
        await this.client.del(...keys);
        count += keys.length;
      }
    }
    return count;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  getClient(): Redis {
    return this.client;
  }
}
