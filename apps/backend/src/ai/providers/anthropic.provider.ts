import Anthropic from '@anthropic-ai/sdk';
import {
  AiProvider,
  AiProviderConfig,
  AiTestResult,
} from './ai-provider.interface';

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(config: AiProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.endpoint ? { baseURL: config.endpoint } : {}),
    });
    this.model = config.model || 'claude-sonnet-4-6';
  }

  async *streamTransform(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): AsyncGenerator<string> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        (event.delta as any).type === 'text_delta'
      ) {
        yield (event.delta as any).text;
      }
    }
  }

  async testConnection(): Promise<AiTestResult> {
    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      });
      return { ok: true };
    } catch (err: any) {
      return {
        ok: false,
        message: mapProviderError('Anthropic', err),
      };
    }
  }
}

function mapProviderError(provider: string, err: any): string {
  const status = err?.status || err?.statusCode;
  if (status === 401) {
    return 'Authentication failed — check your API key';
  }
  if (status === 429) {
    return 'AI request rate limit reached — try again in a moment';
  }
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND') {
    return `Could not reach ${provider} — check URL or network`;
  }
  if (err?.code === 'ETIMEDOUT' || err?.name === 'AbortError') {
    return 'AI request timed out — please try again';
  }
  return err?.message || `${provider} request failed`;
}
