import { spawn, type ChildProcess } from 'child_process';
import { writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  AiProvider,
  AiProviderConfig,
  AiTestResult,
} from './ai-provider.interface';

const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const CODEX_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const STREAM_TIMEOUT_MS = 120_000;

interface CodexTokenPayload {
  access_token: string;
  refresh_token?: string | null;
  expires_at?: number;
  chatgpt_account_id?: string | null;
  id_token?: string | null;
}

function parseToken(raw?: string): CodexTokenPayload | null {
  if (!raw) return null;
  if (raw.startsWith('{')) {
    try {
      return JSON.parse(raw);
    } catch {
      return { access_token: raw };
    }
  }
  return { access_token: raw };
}

/**
 * OpenAI Codex (Subscription) provider.
 * Uses ChatGPT Plus/Pro subscription via OAuth PKCE.
 * Delegates to `codex exec` CLI (like claude-cli provider).
 */
export class OpenAiCodexProvider implements AiProvider {
  readonly name = 'openai-codex';
  private tokenPayload: CodexTokenPayload | null;
  private model: string;

  constructor(config: AiProviderConfig) {
    this.tokenPayload = parseToken(config.apiKey);
    this.model = config.model || 'gpt-4o';
  }

  /**
   * Write Codex CLI auth.json so `codex exec` can authenticate.
   */
  private writeAuthFile(): void {
    if (!this.tokenPayload) return;
    const codexDir = join(homedir(), '.codex');
    mkdirSync(codexDir, { recursive: true });

    const authData: Record<string, any> = {
      OPENAI_API_KEY: null,
      tokens: {
        access_token: this.tokenPayload.access_token,
        refresh_token: this.tokenPayload.refresh_token || '',
        account_id: this.tokenPayload.chatgpt_account_id || '',
      },
      last_refresh: new Date().toISOString(),
    };
    // Codex CLI expects id_token as a string, not null
    if (this.tokenPayload.id_token) {
      authData.tokens = { id_token: this.tokenPayload.id_token, ...authData.tokens };
    }

    writeFileSync(
      join(codexDir, 'auth.json'),
      JSON.stringify(authData, null, 2),
      { mode: 0o600 },
    );
  }

  /**
   * Remove auth.json after CLI process completes to minimize credential exposure.
   */
  private cleanupAuthFile(): void {
    try {
      unlinkSync(join(homedir(), '.codex', 'auth.json'));
    } catch {
      // File may already be removed — ignore
    }
  }

  async *streamTransform(
    systemPrompt: string,
    userMessage: string,
    _maxTokens: number,
  ): AsyncGenerator<string> {
    this.writeAuthFile();

    const prompt = `${systemPrompt}\n\n${userMessage}`;
    const args = [
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--dangerously-bypass-approvals-and-sandbox',
      prompt,
    ];

    const child: ChildProcess = spawn('codex', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => child.kill('SIGTERM'), STREAM_TIMEOUT_MS);
    const stdout = child.stdout!;
    let stderrData = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrData += chunk.toString();
    });
    let buffer = '';

    try {
      for await (const chunk of stdout) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            // Codex JSONL: {"type":"item.completed","item":{"text":"..."}}
            if (parsed.type === 'item.completed' && parsed.item?.text) {
              yield parsed.item.text;
            } else if (parsed.type === 'error' && parsed.message) {
              throw new Error(parsed.message);
            }
          } catch {
            // Not JSON — might be raw text output
            if (line.trim() && !line.startsWith('{')) {
              yield line;
            }
          }
        }
      }
    } finally {
      clearTimeout(timeout);
      if (!child.killed) child.kill('SIGTERM');
      this.cleanupAuthFile();
    }

    const exitCode = await new Promise<number | null>((resolve) => {
      if (child.exitCode !== null) resolve(child.exitCode);
      else child.on('exit', (code) => resolve(code));
    });
    if (exitCode !== 0) {
      // Sanitize stderr — strip file paths and system info
      const sanitized = (stderrData.trim() || `codex exec exited with code ${exitCode}`)
        .replace(/\/[\w/.-]+/g, '[path]')
        .slice(0, 200);
      throw new Error(sanitized);
    }
  }

  async testConnection(): Promise<AiTestResult> {
    if (!this.tokenPayload) {
      return {
        ok: false,
        message: 'No token. Click "Connect ChatGPT Account" to authenticate.',
      };
    }

    // Check if codex CLI is installed
    try {
      const version = await this.runCommand('codex', ['--version'], 5000);
      if (!version.match(/\d+\.\d+/)) {
        return { ok: false, message: 'Codex CLI not found' };
      }
    } catch {
      return {
        ok: false,
        message: 'Codex CLI is not installed. Install with: npm install -g @openai/codex',
      };
    }

    // Write auth file, test, then cleanup
    this.writeAuthFile();

    try {
      const result = await this.runCommand(
        'codex',
        [
          'exec',
          '--skip-git-repo-check',
          '--dangerously-bypass-approvals-and-sandbox',
          'Say "ok"',
        ],
        30000,
      );
      if (result.length > 0) {
        return {
          ok: true,
          message: `OpenAI Codex connected (model: ${this.model})`,
        };
      }
      return {
        ok: true,
        message: `Codex responded (model: ${this.model})`,
      };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Test failed' };
    } finally {
      this.cleanupAuthFile();
    }
  }

  private runCommand(
    cmd: string,
    args: string[],
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Timeout'));
      }, timeoutMs);
      child.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      child.on('exit', (code) => {
        clearTimeout(timeout);
        code === 0
          ? resolve(stdout.trim())
          : reject(
              new Error(
                stderr.trim() || stdout.trim() || `Exit code ${code}`,
              ),
            );
      });
    });
  }
}
