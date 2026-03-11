import { EmailProvider, SendEmailOptions } from './email-provider.interface';

export interface MandrillConfig {
  apiKey: string;
}

/** Parse "Name <email>" or plain email into separate parts */
function parseFromAddress(from: string): { email: string; name?: string } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: from.trim() };
}

export class MandrillProvider implements EmailProvider {
  private readonly baseUrl = 'https://mandrillapp.com/api/1.0';

  constructor(
    private config: MandrillConfig,
    private defaultFrom: string,
  ) {}

  async send(options: SendEmailOptions): Promise<void> {
    const from = parseFromAddress(options.from || this.defaultFrom);

    const response = await fetch(`${this.baseUrl}/messages/send.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: this.config.apiKey,
        message: {
          html: options.html,
          subject: options.subject,
          from_email: from.email,
          from_name: from.name,
          to: [{ email: options.to, type: 'to' }],
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mandrill error ${response.status}: ${body}`);
    }

    // Check for per-recipient rejection
    const result = await response.json();
    if (Array.isArray(result) && result[0]?.status === 'rejected') {
      throw new Error(`Mandrill rejected: ${result[0].reject_reason || 'unknown reason'}`);
    }
    if (Array.isArray(result) && result[0]?.status === 'invalid') {
      throw new Error('Mandrill: invalid recipient');
    }
  }

  async verify(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/users/ping2.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: this.config.apiKey }),
      });

      if (!response.ok) return false;
      const data = await response.json();
      return data.PING === 'PONG!';
    } catch {
      return false;
    }
  }
}
