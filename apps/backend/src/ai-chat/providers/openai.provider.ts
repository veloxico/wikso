import { Injectable, Logger } from '@nestjs/common';
import type { AiProvider, AiChatOptions } from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  getDefaultModel(): string {
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  async chat(options: AiChatOptions): Promise<ReadableStream<Uint8Array>> {
    const apiKey = process.env.OPENAI_API_KEY!;
    const model = options.model || this.getDefaultModel();
    const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    const body = {
      model,
      stream: true,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      this.logger.warn(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
      throw new Error(`OpenAI API error (${res.status})`);
    }

    return this.toSseStream(res.body);
  }

  private toSseStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buffer = '';

    return new ReadableStream<Uint8Array>({
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
                  const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
                  if (delta) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
                  }
                } catch {
                  // Ignore
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
  }
}
