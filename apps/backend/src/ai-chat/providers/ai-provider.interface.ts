/**
 * Minimal AI provider contract used by the ai-chat module.
 *
 * A provider implements `chat()` and returns a ReadableStream of SSE-formatted
 * chunks: each chunk is a line of the form
 *   data: {"delta":"...chunk of text..."}\n\n
 * terminated by a final
 *   data: [DONE]\n\n
 *
 * This matches the same wire protocol used by the frontend for the existing
 * /ai/transform endpoint, so the consumer code (useAiChat hook) can parse
 * events identically.
 */

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatOptions {
  messages: AiChatMessage[];
  model?: string;
  stream: true;
  signal?: AbortSignal;
}

export interface AiProvider {
  /** Human-readable identifier ("anthropic" | "openai" | "ollama" | "stub") */
  readonly name: string;
  /** Whether this provider has sufficient config to be usable. */
  isAvailable(): boolean;
  /** Returns the default model name for the provider. */
  getDefaultModel(): string;
  /**
   * Streams an assistant reply as SSE. The caller is responsible for piping
   * the returned stream to an HTTP response.
   */
  chat(options: AiChatOptions): Promise<ReadableStream<Uint8Array>>;
}
