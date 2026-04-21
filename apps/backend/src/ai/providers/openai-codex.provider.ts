import { spawn, type ChildProcess } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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
   * Write Codex CLI auth.json into a per-call temporary directory and return
   * its path. Each invocation uses an isolated CODEX_HOME so concurrent
   * requests cannot race each other on a shared `~/.codex/auth.json` (and
   * never clobber the host operator's real Codex credentials).
   */
  private writeAuthFile(): string | null {
    if (!this.tokenPayload) return null;
    const codexHome = mkdtempSync(join(tmpdir(), 'wikso-codex-'));

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
      join(codexHome, 'auth.json'),
      JSON.stringify(authData, null, 2),
      { mode: 0o600 },
    );
    return codexHome;
  }

  /**
   * Tear down the per-call temp directory after the CLI process completes
   * so credentials and any rotated tokens are removed from disk.
   */
  private cleanupAuthFile(codexHome: string | null): void {
    if (!codexHome) return;
    try {
      rmSync(codexHome, { recursive: true, force: true });
    } catch {
      // Best-effort — temp directory may be reaped by the OS regardless.
    }
  }

  async *streamTransform(
    systemPrompt: string,
    userMessage: string,
    _maxTokens: number,
  ): AsyncGenerator<string> {
    const codexHome = this.writeAuthFile();

    const prompt = `${systemPrompt}\n\n${userMessage}`;
    // SECURITY: Text transforms must NEVER be allowed to execute shell or write
    // files — `selection`/`context`/`customPrompt` are user-controlled, so any
    // unsandboxed exec is a prompt-injection RCE primitive against the backend
    // (env vars include JWT_SECRET, ENCRYPTION_KEY, S3 credentials, etc.).
    // We pin `--ask-for-approval never` + `--sandbox read-only` so the agent
    // can stream a text response but cannot mutate the filesystem or execute
    // arbitrary tool calls. DO NOT add `--dangerously-bypass-approvals-and-sandbox`.
    const args = [
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--ask-for-approval',
      'never',
      '--sandbox',
      'read-only',
      prompt,
    ];

    const child: ChildProcess = spawn('codex', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: codexHome
        ? { ...process.env, CODEX_HOME: codexHome }
        : process.env,
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
      this.cleanupAuthFile(codexHome);
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

    // Write auth file in per-call temp dir, test, then cleanup
    const codexHome = this.writeAuthFile();

    try {
      const result = await this.runCommand(
        'codex',
        [
          'exec',
          '--skip-git-repo-check',
          '--ask-for-approval',
          'never',
          '--sandbox',
          'read-only',
          'Say "ok"',
        ],
        30000,
        codexHome ? { ...process.env, CODEX_HOME: codexHome } : undefined,
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
      this.cleanupAuthFile(codexHome);
    }
  }

  private runCommand(
    cmd: string,
    args: string[],
    timeoutMs: number,
    env?: NodeJS.ProcessEnv,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: env || process.env,
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
