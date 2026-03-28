import OpenAI from 'openai';
import {
  AiProvider,
  AiProviderConfig,
  AiTestResult,
} from './ai-provider.interface';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor(config: AiProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.endpoint ? { baseURL: config.endpoint } : {}),
    });
    this.model = config.model || 'gpt-4o';
  }

  async *streamTransform(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }

  async testConnection(): Promise<AiTestResult> {
    try {
      await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      });
      return { ok: true };
    } catch (err: any) {
      return {
        ok: false,
        message: mapProviderError('OpenAI', err),
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
