import { Injectable, Logger } from '@nestjs/common';
import type { AiProvider, AiChatOptions } from './ai-provider.interface';

@Injectable()
export class OllamaProvider implements AiProvider {
  readonly name = 'ollama';
  private readonly logger = new Logger(OllamaProvider.name);

  isAvailable(): boolean {
    return !!process.env.OLLAMA_HOST;
  }

  getDefaultModel(): string {
    return process.env.OLLAMA_MODEL || 'llama3';
  }

  async chat(options: AiChatOptions): Promise<ReadableStream<Uint8Array>> {
    const host = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
    const model = options.model || this.getDefaultModel();

    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: options.signal,
    });

    if (!res.ok || !res.body) {
      const err = await res.text().catch(() => '');
      this.logger.warn(`Ollama error ${res.status}: ${err.slice(0, 200)}`);
      throw new Error(`Ollama API error (${res.status})`);
    }

    return this.toSseStream(res.body);
  }

  /** Ollama emits newline-delimited JSON, not SSE — convert to SSE. */
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
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const parsed = JSON.parse(trimmed);
                const delta: string | undefined = parsed?.message?.content;
                if (delta) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
                }
              } catch {
                // Ignore
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
