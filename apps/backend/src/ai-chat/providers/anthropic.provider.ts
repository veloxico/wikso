import { Injectable, Logger } from '@nestjs/common';
import type { AiProvider, AiChatOptions } from './ai-provider.interface';

/**
 * Anthropic Claude provider.
 *
 * Supports both raw API keys (`sk-ant-api03-*`) and OAuth setup tokens
 * (`sk-ant-oat01-*`). Setup tokens require a specific set of headers to be
 * accepted by the Anthropic API.
 */
@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  getDefaultModel(): string {
    return process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
  }

  async chat(options: AiChatOptions): Promise<ReadableStream<Uint8Array>> {
    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const model = options.model || this.getDefaultModel();
    const isOauth = apiKey.startsWith('sk-ant-oat01-');

    // Split system messages from conversation messages (Anthropic's format).
    const systemParts = options.messages.filter((m) => m.role === 'system').map((m) => m.content);
    const conversation = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };

    if (isOauth) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['anthropic-beta'] = 'claude-code-20250219,oauth-2025-04-20';
      headers['User-Agent'] = 'claude-code/2.1.56';
    } else {
      headers['x-api-key'] = apiKey;
    }

    const body = {
      model,
      max_tokens: 2048,
      stream: true,
      system: systemParts.join('\n\n') || undefined,
      messages: conversation,
    };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      this.logger.warn(`Anthropic error ${res.status}: ${errText.slice(0, 200)}`);
      throw new Error(`Anthropic API error (${res.status})`);
    }

    return this.toSseStream(res.body);
  }

  /**
   * Convert Anthropic's SSE message stream into the internal wire format
   * (`data: {"delta":"..."}\n\n` chunks + terminating `data: [DONE]`).
   */
  private toSseStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buffer = '';

    const transformed = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = source.getReader();
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const ev of events) {
              for (const line of ev.split('\n')) {
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (!data || data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  const delta: string | undefined =
                    parsed?.delta?.text ?? parsed?.content_block?.text;
                  if (delta) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
                  }
                } catch {
                  // Ignore malformed lines (keep-alive pings, etc.)
                }
              }
            }
          }
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return transformed;
  }
}
