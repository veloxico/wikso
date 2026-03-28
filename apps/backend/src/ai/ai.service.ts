import { Injectable, Logger } from '@nestjs/common';
import { AiProviderRegistry } from './ai-provider.registry';
import { AiOperation } from './dto/ai-transform.dto';

const OPERATION_PROMPTS: Record<AiOperation, string> = {
  [AiOperation.EXPAND]:
    'Expand the following text with more detail, examples, and explanation while keeping the same tone and style. Return only the expanded text, no preamble.',
  [AiOperation.SUMMARIZE]:
    'Summarize the following text concisely while preserving key points. Return only the summary, no preamble.',
  [AiOperation.FIX_GRAMMAR]:
    'Fix grammar, spelling, and punctuation errors in the following text. Keep the original meaning and tone. Return only the corrected text, no preamble.',
  [AiOperation.CHANGE_TONE]:
    'Rewrite the following text in a more professional and polished tone while preserving the original meaning. Return only the rewritten text, no preamble.',
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly maxTokens: number;

  constructor(private registry: AiProviderRegistry) {
    this.maxTokens = parseInt(process.env.AI_MAX_TOKENS || '2048', 10);
  }

  async *streamTransform(
    selection: string,
    operation: AiOperation,
    context?: string,
  ): AsyncGenerator<string> {
    const provider = await this.registry.getActiveProvider();
    if (!provider) {
      throw new Error('NO_PROVIDER_CONFIGURED');
    }

    const systemPrompt = OPERATION_PROMPTS[operation];
    let userMessage = selection;

    if (context) {
      const trimmedContext = context.slice(0, 4000);
      userMessage = `Context:\n${trimmedContext}\n\n---\n\nText to transform:\n${selection}`;
    }

    yield* provider.streamTransform(systemPrompt, userMessage, this.maxTokens);
  }

  async isEnabled(): Promise<boolean> {
    return this.registry.isEnabled();
  }

  async getStatus(): Promise<{ aiEnabled: boolean; provider: string | null }> {
    return this.registry.getStatus();
  }
}
