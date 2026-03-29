import Anthropic from '@anthropic-ai/sdk';
import {
  AiProvider,
  AiProviderConfig,
  AiTestResult,
} from './ai-provider.interface';
import { mapProviderError } from './provider-error.util';

function isOAuthToken(apiKey?: string): boolean {
  return typeof apiKey === 'string' && apiKey.includes('sk-ant-oat');
}

const OAUTH_BETAS = ['claude-code-20250219', 'oauth-2025-04-20'];
const CLAUDE_CODE_UA = 'claude-code/2.1.56';

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;
  private useOAuth: boolean;

  constructor(config: AiProviderConfig) {
    this.useOAuth = isOAuthToken(config.apiKey);
    this.client = new Anthropic({
      apiKey: this.useOAuth ? '' : config.apiKey,
      ...(config.endpoint ? { baseURL: config.endpoint } : {}),
      defaultHeaders: {
        ...(this.useOAuth
          ? {
              Authorization: `Bearer ${config.apiKey}`,
              'anthropic-beta': OAUTH_BETAS.join(','),
              'User-Agent': CLAUDE_CODE_UA,
              'x-api-key': undefined as any,
            }
          : {}),
      },
    });
    this.model = config.model || 'claude-sonnet-4-6';
  }

  async *streamTransform(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): AsyncGenerator<string> {
    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
    } catch (err: any) {
      throw new Error(mapProviderError('Anthropic', err));
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
