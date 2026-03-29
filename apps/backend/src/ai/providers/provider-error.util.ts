export function mapProviderError(provider: string, err: any): string {
  const status = err?.status || err?.statusCode;
  if (status === 401) {
    return 'Authentication failed — check your API key';
  }
  if (status === 400 || status === 404) {
    return `Invalid request — check your model name and configuration`;
  }
  if (status === 429) {
    return 'AI request rate limit reached — try again in a moment';
  }
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND') {
    return `Could not reach ${provider} — check URL or network`;
  }
  if (err?.code === 'ETIMEDOUT' || err?.name === 'AbortError') {
    return 'AI request timed out — please try again';
  }
  return err?.message || `${provider} request failed`;
}
