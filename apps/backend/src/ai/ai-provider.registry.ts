import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { encrypt, decrypt } from '../common/utils/encryption';
import {
  AiProvider,
  AiProviderConfig,
  AiProviderType,
} from './providers/ai-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { OllamaProvider } from './providers/ollama.provider';

const CACHE_KEY = 'cache:ai-config:active';
const CACHE_TTL = 60; // 60 seconds

const ENCRYPTED_FIELDS = ['apiKey', 'endpoint', 'deployment'] as const;

@Injectable()
export class AiProviderRegistry {
  private readonly logger = new Logger(AiProviderRegistry.name);
  private memoryCache: any | null = null;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getActiveProvider(): Promise<AiProvider | null> {
    const config = await this.getActiveConfig();
    if (!config) return null;

    return this.createProvider(config.provider as AiProviderType, {
      apiKey: config.apiKey ? this.safeDecrypt(config.apiKey) : undefined,
      endpoint: config.endpoint
        ? this.safeDecrypt(config.endpoint)
        : undefined,
      model: config.model || undefined,
      deployment: config.deployment
        ? this.safeDecrypt(config.deployment)
        : undefined,
      apiVersion: config.apiVersion || undefined,
    });
  }

  async isEnabled(): Promise<boolean> {
    const config = await this.getActiveConfig();
    return config !== null;
  }

  async getStatus(): Promise<{ aiEnabled: boolean; provider: string | null }> {
    const config = await this.getActiveConfig();
    return {
      aiEnabled: config !== null,
      provider: config?.provider || null,
    };
  }

  async getProviderName(): Promise<string | null> {
    const config = await this.getActiveConfig();
    return config?.provider || null;
  }

  async getAllConfigs(): Promise<any[]> {
    const configs = await this.prisma.aiConfig.findMany({
      orderBy: { provider: 'asc' },
    });

    return configs.map((c) => ({
      ...c,
      apiKey: c.apiKey ? maskSecret(this.safeDecrypt(c.apiKey)) : null,
      endpoint: c.endpoint ? maskSecret(this.safeDecrypt(c.endpoint)) : null,
      deployment: c.deployment
        ? maskSecret(this.safeDecrypt(c.deployment))
        : null,
    }));
  }

  async invalidateCache(): Promise<void> {
    this.memoryCache = null;
    try {
      await this.redis.del(CACHE_KEY);
    } catch {
      // Non-critical
    }
  }

  encryptFields(data: Record<string, any>): Record<string, any> {
    const result = { ...data };
    for (const field of ENCRYPTED_FIELDS) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = encrypt(result[field]);
      }
    }
    return result;
  }

  // ─── Private ──────────────────────────────────────────

  private async getActiveConfig(): Promise<any | null> {
    // 1. Try Redis cache
    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.memoryCache = parsed;
        return parsed;
      }
    } catch {
      // Redis unavailable
    }

    // 2. Try in-memory fallback
    if (this.memoryCache) return this.memoryCache;

    // 3. Try DB
    const dbConfig = await this.prisma.aiConfig.findFirst({
      where: { isActive: true },
    });

    if (dbConfig) {
      this.memoryCache = dbConfig;
      try {
        await this.redis.set(CACHE_KEY, JSON.stringify(dbConfig), CACHE_TTL);
      } catch {
        // Non-critical
      }
      return dbConfig;
    }

    // 4. Env var fallback
    if (process.env.ANTHROPIC_API_KEY) {
      const fallback = {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY, // plaintext, not encrypted
        model: process.env.AI_MODEL || 'claude-sonnet-4-6',
        endpoint: null,
        deployment: null,
        apiVersion: null,
        isActive: true,
        _envFallback: true, // marker so we skip decryption
      };
      this.memoryCache = fallback;
      return fallback;
    }

    return null;
  }

  safeDecrypt(value: string): string {
    // Env var fallback values are plaintext
    if (!value.includes(':')) return value;
    try {
      return decrypt(value);
    } catch {
      return value;
    }
  }

  private createProvider(
    type: AiProviderType,
    config: AiProviderConfig,
  ): AiProvider {
    switch (type) {
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'openai':
        return new OpenAiProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      default:
        throw new Error(`Unknown AI provider: ${type}`);
    }
  }
}

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return value.substring(0, 4) + '...' + value.substring(value.length - 4);
}
