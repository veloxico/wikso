/**
 * Tiny REST client for the Wikso backend.
 *
 * Reads the following env vars at construction time:
 *   - WIKSO_BASE_URL  (e.g. http://localhost:3000/api/v1)
 *   - WIKSO_TOKEN     (JWT bearer token)
 *
 * All requests are authenticated via `Authorization: Bearer <token>`.
 * HTTP errors are surfaced as `WiksoApiError` with status + body for
 * transparent reporting back to the LLM caller.
 */

export class WiksoApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'WiksoApiError';
    this.status = status;
    this.body = body;
  }
}

export interface WiksoClientConfig {
  baseUrl: string;
  token: string;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function loadConfigFromEnv(): WiksoClientConfig {
  const baseUrl = process.env.WIKSO_BASE_URL?.trim();
  const token = process.env.WIKSO_TOKEN?.trim();

  const missing: string[] = [];
  if (!baseUrl) missing.push('WIKSO_BASE_URL');
  if (!token) missing.push('WIKSO_TOKEN');
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
        `Set WIKSO_BASE_URL (e.g. http://localhost:3000/api/v1) and WIKSO_TOKEN (a JWT) before starting the server.`,
    );
  }

  return {
    baseUrl: stripTrailingSlash(baseUrl!),
    token: token!,
  };
}

export class WiksoClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: WiksoClientConfig) {
    this.baseUrl = stripTrailingSlash(config.baseUrl);
    this.token = config.token;
  }

  /**
   * Perform an authenticated request. `path` should begin with a leading slash
   * (e.g. "/spaces"). Query params are passed as an object and serialized with
   * URLSearchParams, skipping undefined values.
   */
  async request<T = unknown>(
    method: string,
    path: string,
    options: { query?: Record<string, string | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(url, { method, headers, body });
    } catch (err: any) {
      throw new WiksoApiError(
        0,
        `Network error calling ${method} ${url.pathname}: ${err?.message ?? err}`,
        null,
      );
    }

    const text = await response.text();
    let parsed: unknown = undefined;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const summary =
        (parsed as any)?.message ??
        (typeof parsed === 'string' ? parsed : response.statusText);
      throw new WiksoApiError(
        response.status,
        `Wikso API ${method} ${url.pathname} failed with ${response.status}: ${summary}`,
        parsed,
      );
    }

    return parsed as T;
  }

  get<T = unknown>(path: string, query?: Record<string, string | undefined>) {
    return this.request<T>('GET', path, { query });
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body });
  }

  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, { body });
  }

  delete<T = unknown>(path: string) {
    return this.request<T>('DELETE', path);
  }
}
