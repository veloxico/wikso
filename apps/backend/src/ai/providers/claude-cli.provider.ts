import { spawn, type ChildProcess } from 'child_process';
import {
  AiProvider,
  AiProviderConfig,
  AiTestResult,
} from './ai-provider.interface';
import { AnthropicProvider } from './anthropic.provider';

const MODEL_ALIASES: Record<string, string> = {
  'claude-opus-4-6': 'opus',
  'claude-opus-4-5': 'opus',
  'claude-sonnet-4-6': 'sonnet',
  'claude-sonnet-4-5': 'sonnet',
  'claude-haiku-4-5': 'haiku',
  opus: 'opus',
  sonnet: 'sonnet',
  haiku: 'haiku',
};

// CLI alias → API model ID
const CLI_TO_API_MODEL: Record<string, string> = {
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
  haiku: 'claude-haiku-4-5',
};

const STREAM_TIMEOUT_MS = 120_000;

/**
 * Claude CLI (Subscription) provider.
 *
 * With a setup token: uses direct Anthropic API calls with OAuth headers.
 * Without a token: falls back to locally installed `claude` CLI.
 */
export class ClaudeCliProvider implements AiProvider {
  readonly name = 'claude-cli';
  private cliAlias: string;
  private apiModel: string;
  private setupToken?: string;
  private directProvider?: AnthropicProvider;

  constructor(config: AiProviderConfig) {
    const raw = config.model || 'haiku';
    this.cliAlias = MODEL_ALIASES[raw] || raw;
    this.apiModel = CLI_TO_API_MODEL[this.cliAlias] || raw;
    this.setupToken = config.apiKey;

    if (this.setupToken) {
      this.directProvider = new AnthropicProvider({
        apiKey: this.setupToken,
        model: this.apiModel,
      });
    }
  }

  async *streamTransform(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): AsyncGenerator<string> {
    if (this.directProvider) {
      yield* this.directProvider.streamTransform(
        systemPrompt,
        userMessage,
        maxTokens,
      );
      return;
    }

    // CLI fallback
    yield* this.cliStream(systemPrompt, userMessage);
  }

  async testConnection(): Promise<AiTestResult> {
    if (this.directProvider) {
      return this.directProvider.testConnection();
    }

    // CLI fallback
    try {
      const version = await this.runCommand('claude', ['--version'], 5000);
      if (!version.match(/\d+\.\d+/)) {
        return { ok: false, message: 'Claude CLI not found' };
      }
    } catch {
      return {
        ok: false,
        message: 'Claude CLI is not installed.',
      };
    }

    try {
      const env = { ...process.env };
      delete env.CLAUDECODE;
      const result = await this.runCommand(
        'claude',
        ['-p', '--model', this.cliAlias, 'Say "ok"'],
        30000,
        env,
      );
      if (result.toLowerCase().includes('ok')) {
        return { ok: true, message: `Working (model: ${this.cliAlias})` };
      }
      return { ok: true, message: `Responded (model: ${this.cliAlias})` };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Test failed' };
    }
  }

  private async *cliStream(
    systemPrompt: string,
    userMessage: string,
  ): AsyncGenerator<string> {
    const prompt = `${systemPrompt}\n\n${userMessage}`;
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', this.cliAlias, prompt];
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const child: ChildProcess = spawn('claude', args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => child.kill('SIGTERM'), STREAM_TIMEOUT_MS);
    const stdout = child.stdout!;
    let buffer = '';
    let stderrData = '';
    child.stderr?.on('data', (chunk: Buffer) => { stderrData += chunk.toString(); });

    try {
      for await (const chunk of stdout) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'assistant' && parsed.message?.content) {
              for (const block of parsed.message.content) {
                if (block.type === 'text' && block.text) yield block.text;
              }
            }
          } catch { /* skip */ }
        }
      }
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.type === 'assistant' && parsed.message?.content) {
            for (const block of parsed.message.content) {
              if (block.type === 'text' && block.text) yield block.text;
            }
          }
        } catch { /* skip */ }
      }
    } finally {
      clearTimeout(timeout);
      if (!child.killed) child.kill('SIGTERM');
    }

    const exitCode = await new Promise<number | null>((resolve) => {
      if (child.exitCode !== null) resolve(child.exitCode);
      else child.on('exit', (code) => resolve(code));
    });
    if (exitCode !== 0) {
      throw new Error(stderrData.trim() || `Claude CLI exited with code ${exitCode}`);
    }
  }

  private runCommand(cmd: string, args: string[], timeoutMs: number, env?: NodeJS.ProcessEnv): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { env: env || process.env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Timeout')); }, timeoutMs);
      child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      child.on('error', (err) => { clearTimeout(timeout); reject(err); });
      child.on('exit', (code) => {
        clearTimeout(timeout);
        code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || stdout.trim() || `Exit code ${code}`));
      });
    });
  }
}
