import {
  AiProvider,
  AiProviderConfig,
  AiTestResult,
} from './ai-provider.interface';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const STREAM_TIMEOUT_MS = 120_000;

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: AiProviderConfig) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || DEFAULT_MODEL;
    this.baseUrl = (config.endpoint || BASE_URL).replace(/\/+$/, '');
  }

  async *streamTransform(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): AsyncGenerator<string> {
    const url = `${this.baseUrl}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const body = {
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(mapGeminiError(res.status, text));
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body from Gemini');

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
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (!json || json === '[DONE]') continue;

          try {
            const parsed = JSON.parse(json);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield text;
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      // Flush remaining buffer
      if (buffer.startsWith('data: ')) {
        const json = buffer.slice(6).trim();
        if (json && json !== '[DONE]') {
          try {
            const parsed = JSON.parse(json);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch {
            // skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async testConnection(): Promise<AiTestResult> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "ok"' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, message: mapGeminiError(res.status, text) };
      }

      const data: any = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) {
        return { ok: true, message: `Gemini connected (model: ${this.model})` };
      }
      return { ok: true, message: 'Gemini connected' };
    } catch (err: any) {
      if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND') {
        return { ok: false, message: 'Could not reach Gemini API' };
      }
      if (err?.name === 'AbortError' || err?.code === 'ETIMEDOUT') {
        return { ok: false, message: 'Gemini request timed out' };
      }
      return { ok: false, message: err?.message || 'Gemini connection failed' };
    }
  }
}

function mapGeminiError(status: number, body: string): string {
  if (status === 400) {
    if (body.includes('API_KEY_INVALID') || body.includes('API key not valid')) {
      return 'Invalid API key — check your Google AI Studio key';
    }
    return 'Invalid request — check model name and configuration';
  }
  if (status === 401 || status === 403) {
    return 'Authentication failed — check your API key';
  }
  if (status === 404) {
    return 'Model not found — check the model name';
  }
  if (status === 429) {
    return 'Rate limit reached — try again in a moment';
  }
  try {
    const parsed = JSON.parse(body);
    return parsed?.error?.message || `Gemini API error (${status})`;
  } catch {
    return `Gemini API error (${status})`;
  }
}
