export interface AiProviderConfig {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  deployment?: string;
  apiVersion?: string;
  /**
   * Optional callback invoked when an OAuth provider rotates its credentials
   * mid-flight (e.g. Gemini CLI silently refreshing an expired access token
   * via its refresh_token). The new payload is the JSON string the provider
   * wants written back to AiConfig.apiKey so the next request — possibly on
   * another replica or after a restart — picks up the rotated token instead
   * of refreshing again. Implementations MUST encrypt the value and persist
   * to the DB; the provider is decoupled from storage.
   */
  onTokenRefresh?: (newApiKeyJson: string) => Promise<void>;
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
