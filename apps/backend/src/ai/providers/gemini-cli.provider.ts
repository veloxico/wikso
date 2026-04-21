import { spawn, type ChildProcess } from 'child_process';
import {
  AiProvider,
  AiProviderConfig,
  AiTestResult,
} from './ai-provider.interface';

const STREAM_TIMEOUT_MS = 120_000;

// Gemini OAuth client credentials — must be set via env vars
const GEMINI_CLIENT_ID = process.env.GEMINI_CLI_OAUTH_CLIENT_ID || '';
const GEMINI_CLIENT_SECRET = process.env.GEMINI_CLI_OAUTH_CLIENT_SECRET || '';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface GeminiTokenPayload {
  access_token: string;
  refresh_token?: string | null;
  expires_at?: number;
}

/**
 * Parse the stored token — may be a JSON payload with refresh token,
 * or a plain access token string (legacy).
 */
function parseToken(raw?: string): GeminiTokenPayload | null {
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
 * Gemini (Subscription) provider.
 * Uses `gemini -p` CLI with OAuth token passed via env vars.
 * Auto-refreshes expired tokens using the refresh token.
 */
export class GeminiCliProvider implements AiProvider {
  readonly name = 'gemini-cli';
  private model: string;
  private tokenPayload: GeminiTokenPayload | null;
  private onTokenRefresh?: (newApiKeyJson: string) => Promise<void>;
  // Coalesce concurrent refreshes — without this, two parallel transforms
  // both observe `isExpired === true`, both POST to Google, and both race
  // to overwrite the row. Last-write-wins is harmless for the access_token
  // itself but burns refresh-token quota and risks rate-limiting.
  private refreshInFlight: Promise<void> | null = null;

  constructor(config: AiProviderConfig) {
    this.model = config.model || 'gemini-2.5-flash';
    this.tokenPayload = parseToken(config.apiKey);
    this.onTokenRefresh = config.onTokenRefresh;
  }

  private async getAccessToken(): Promise<string | undefined> {
    if (!this.tokenPayload) return undefined;

    // Check if token is expired (with 5 min buffer)
    const expiresAt = this.tokenPayload.expires_at || 0;
    const isExpired = expiresAt > 0 && Date.now() > expiresAt - 5 * 60 * 1000;

    if (isExpired && this.tokenPayload.refresh_token) {
      // Reuse any in-flight refresh from a sibling request so we don't double-POST.
      if (!this.refreshInFlight) {
        this.refreshInFlight = this.doRefresh().finally(() => {
          this.refreshInFlight = null;
        });
      }
      try {
        await this.refreshInFlight;
      } catch {
        // refresh failed, fall through and try with the (possibly expired) token
      }
    }

    return this.tokenPayload.access_token;
  }

  private async doRefresh(): Promise<void> {
    if (!this.tokenPayload?.refresh_token) return;
    const body = new URLSearchParams({
      client_id: GEMINI_CLIENT_ID,
      client_secret: GEMINI_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: this.tokenPayload.refresh_token,
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) return;
    const data: any = await res.json();
    if (!data?.access_token) return;

    this.tokenPayload.access_token = data.access_token;
    this.tokenPayload.expires_at =
      Date.now() + (data.expires_in || 3600) * 1000;
    // Google may rotate the refresh_token; keep the new one if returned.
    if (data.refresh_token) {
      this.tokenPayload.refresh_token = data.refresh_token;
    }

    // Persist the rotated payload back to the DB via the callback so the
    // next request — even on a different replica or after a restart —
    // picks up the new access_token instead of refreshing again.
    if (this.onTokenRefresh) {
      try {
        await this.onTokenRefresh(JSON.stringify(this.tokenPayload));
      } catch {
        // Persistence is best-effort — in-memory token still works for this process.
      }
    }
  }

  async *streamTransform(
    systemPrompt: string,
    userMessage: string,
    _maxTokens: number,
  ): AsyncGenerator<string> {
    const accessToken = await this.getAccessToken();
    const prompt = `${systemPrompt}\n\n${userMessage}`;
    const args = ['-p', prompt, '-o', 'stream-json', '-m', this.model, '-y'];

    const env = { ...process.env };
    if (accessToken) {
      env.GOOGLE_GENAI_USE_GCA = 'true';
      env.GOOGLE_CLOUD_ACCESS_TOKEN = accessToken;
    }

    const child: ChildProcess = spawn('gemini', args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => child.kill('SIGTERM'), STREAM_TIMEOUT_MS);
    const stdout = child.stdout!;
    let buffer = '';
    let stderrData = '';
    child.stderr?.on('data', (c: Buffer) => {
      stderrData += c.toString();
    });

    try {
      for await (const chunk of stdout) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (
              parsed.type === 'message' &&
              parsed.role === 'assistant' &&
              parsed.content
            ) {
              yield parsed.content;
            } else if (parsed.result && typeof parsed.result === 'string') {
              yield parsed.result;
            } else if (parsed.text) {
              yield parsed.text;
            }
          } catch {
            /* skip */
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (
            parsed.type === 'message' &&
            parsed.role === 'assistant' &&
            parsed.content
          ) {
            yield parsed.content;
          } else if (parsed.result && typeof parsed.result === 'string') {
            yield parsed.result;
          }
        } catch {
          /* skip */
        }
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
      throw new Error(
        stderrData.trim() ||
          `Gemini CLI exited with code ${exitCode}`,
      );
    }
  }

  async testConnection(): Promise<AiTestResult> {
    // Check if gemini CLI exists
    try {
      const version = await this.runCommand('gemini', ['--version'], 5000);
      if (!version.match(/\d+\.\d+/)) {
        return {
          ok: false,
          message: 'Gemini CLI not found. Install: npm install -g @google/gemini-cli',
        };
      }
    } catch {
      return {
        ok: false,
        message: 'Gemini CLI not installed. Install: npm install -g @google/gemini-cli',
      };
    }

    // Test prompt
    try {
      const accessToken = await this.getAccessToken();
      const env = { ...process.env };
      if (accessToken) {
        env.GOOGLE_GENAI_USE_GCA = 'true';
        env.GOOGLE_CLOUD_ACCESS_TOKEN = accessToken;
      }
      const result = await this.runCommand(
        'gemini',
        ['-p', 'Say "ok"', '-m', this.model, '-y'],
        30000,
        env,
      );
      if (result.toLowerCase().includes('ok')) {
        return { ok: true, message: `Gemini working (model: ${this.model})` };
      }
      return { ok: true, message: `Gemini responded (model: ${this.model})` };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Gemini test failed' };
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
        env: env || { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '',
        stderr = '';
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
