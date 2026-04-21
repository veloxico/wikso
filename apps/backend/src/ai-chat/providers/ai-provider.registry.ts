import { Injectable, Logger } from '@nestjs/common';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAiProvider } from './openai.provider';
import { OllamaProvider } from './ollama.provider';
import type { AiProvider } from './ai-provider.interface';

/**
 * Selects the active AI provider based on environment configuration.
 *
 * Priority: AI_PROVIDER env var > first available provider.
 * Returns `null` if no provider has usable credentials — the controller
 * translates that into a 503 response.
 */
@Injectable()
export class AiProviderRegistry {
  private readonly logger = new Logger(AiProviderRegistry.name);

  constructor(
    private readonly anthropic: AnthropicProvider,
    private readonly openai: OpenAiProvider,
    private readonly ollama: OllamaProvider,
  ) {}

  list(): AiProvider[] {
    return [this.anthropic, this.openai, this.ollama];
  }

  getActive(): AiProvider | null {
    const preferred = (process.env.AI_PROVIDER || '').toLowerCase();
    const providers = this.list();

    if (preferred) {
      const match = providers.find((p) => p.name === preferred);
      if (match && match.isAvailable()) return match;
      if (match) {
        this.logger.warn(`AI_PROVIDER=${preferred} selected but not configured; falling back`);
      }
    }

    return providers.find((p) => p.isAvailable()) || null;
  }
}
