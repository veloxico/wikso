import OpenAI from 'openai';
import {
  AiProvider,
  AiProviderConfig,
  AiTestResult,
} from './ai-provider.interface';
import { mapProviderError } from './provider-error.util';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor(config: AiProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? '',
      ...(config.endpoint ? { baseURL: config.endpoint } : {}),
    });
    this.model = config.model || 'gpt-4o';
  }

  async *streamTransform(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): AsyncGenerator<string> {
    try {
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
    } catch (err: any) {
      throw new Error(mapProviderError('OpenAI', err));
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
