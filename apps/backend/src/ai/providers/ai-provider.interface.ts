export interface AiProviderConfig {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  deployment?: string;
  apiVersion?: string;
}

export interface AiTestResult {
  ok: boolean;
  message?: string;
}

export interface AiProvider {
  readonly name: string;
  streamTransform(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): AsyncGenerator<string>;
  testConnection(): Promise<AiTestResult>;
}

export type AiProviderType = 'anthropic' | 'openai' | 'ollama' | 'claude-cli' | 'gemini' | 'gemini-cli' | 'openai-codex';
