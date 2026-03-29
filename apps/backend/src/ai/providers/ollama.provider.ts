import {
  AiProvider,
  AiProviderConfig,
  AiTestResult,
} from './ai-provider.interface';

const DEFAULT_ENDPOINT = 'http://localhost:11434';
const STREAM_TIMEOUT_MS = 120_000; // 2 minutes max for streaming

export class OllamaProvider implements AiProvider {
  readonly name = 'ollama';
  private endpoint: string;
  private model: string;

  constructor(config: AiProviderConfig) {
    this.endpoint = (config.endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, '');
    this.model = config.model || 'llama3';
  }

  async *streamTransform(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): AsyncGenerator<string> {
    const res = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
      body: JSON.stringify({
        model: this.model,
        stream: true,
        options: { num_predict: maxTokens },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama returned ${res.status}: ${text}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body from Ollama');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              yield parsed.message.content;
            }
          } catch {
            // skip malformed NDJSON lines
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.message?.content) {
            yield parsed.message.content;
          }
        } catch {
          // skip
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async testConnection(): Promise<AiTestResult> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return {
          ok: false,
          message: `Ollama returned ${res.status} — check endpoint URL`,
        };
      }

      const data: any = await res.json();
      const models =
        data.models?.map((m: any) => m.name || m.model) || [];

      if (models.length === 0) {
        return {
          ok: false,
          message:
            'Ollama is reachable but has no models — pull one with: ollama pull llama3',
        };
      }

      // Check if the configured model is available
      const modelNames = models.map((m: string) => m.split(':')[0]);
      const configuredBase = this.model.split(':')[0];
      if (
        !models.includes(this.model) &&
        !modelNames.includes(configuredBase)
      ) {
        return {
          ok: false,
          message: `Configured model "${this.model}" is not available. Installed: ${models.join(', ')}`,
        };
      }

      return { ok: true, message: `Connected. Available models: ${models.join(', ')}` };
    } catch (err: any) {
      if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND') {
        return {
          ok: false,
          message: 'Could not reach Ollama — check URL or network',
        };
      }
      if (err?.name === 'AbortError' || err?.code === 'ETIMEDOUT') {
        return { ok: false, message: 'Ollama request timed out — please try again' };
      }
      return { ok: false, message: err?.message || 'Ollama connection failed' };
    }
  }
}
