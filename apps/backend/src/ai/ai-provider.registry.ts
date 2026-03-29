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
import { ClaudeCliProvider } from './providers/claude-cli.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { GeminiCliProvider } from './providers/gemini-cli.provider';
import { OpenAiCodexProvider } from './providers/openai-codex.provider';

const CACHE_KEY = 'cache:ai-config:active';
const CACHE_TTL = 60; // 60 seconds

const ENCRYPTED_FIELDS = ['apiKey', 'deployment'] as const;

@Injectable()
export class AiProviderRegistry {
  private readonly logger = new Logger(AiProviderRegistry.name);
  private memoryCache: any | null = null;
  private memoryCacheSetAt = 0;

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
      apiKey: c.apiKey ? maskSecret(c.apiKey) : null,
      endpoint: c.endpoint || null,
      deployment: c.deployment ? maskSecret(c.deployment) : null,
    }));
  }

  async invalidateCache(): Promise<void> {
    this.memoryCache = null;
    this.memoryCacheSetAt = 0;
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
        this.memoryCacheSetAt = Date.now();
        return parsed;
      }
    } catch {
      // Redis unavailable
    }

    // 2. Try in-memory fallback (with TTL)
    if (
      this.memoryCache &&
      Date.now() - this.memoryCacheSetAt < CACHE_TTL * 1000
    ) {
      return this.memoryCache;
    }
    this.memoryCache = null;

    // 3. Try DB
    const dbConfig = await this.prisma.aiConfig.findFirst({
      where: { isActive: true },
    });

    if (dbConfig) {
      this.memoryCache = dbConfig;
      this.memoryCacheSetAt = Date.now();
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
      this.memoryCacheSetAt = Date.now();
      return fallback;
    }

    return null;
  }

  safeDecrypt(value: string): string {
    // Encrypted values use format iv:authTag:ciphertext (3 colon-separated parts)
    const parts = value.split(':');
    if (parts.length !== 3) return value; // plaintext (env fallback or unencrypted)
    try {
      return decrypt(value);
    } catch (err) {
      this.logger.error('Failed to decrypt AI config field', err);
      throw new Error('Failed to decrypt AI configuration — encryption key may have changed');
    }
  }

  private createProvider(
    type: AiProviderType,
    config: AiProviderConfig,
  ): AiProvider {
    switch (type) {
      case 'anthropic':
      case 'openai':
        if (!config.apiKey) {
          throw new Error(`API key is required for ${type} provider`);
        }
        return type === 'anthropic'
          ? new AnthropicProvider(config)
          : new OpenAiProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      case 'claude-cli':
        return new ClaudeCliProvider(config);
      case 'gemini':
        if (!config.apiKey) {
          throw new Error('API key is required for Gemini provider');
        }
        return new GeminiProvider(config);
      case 'gemini-cli':
        return new GeminiCliProvider(config);
      case 'openai-codex':
        return new OpenAiCodexProvider(config);
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
