import { EmailProvider, SendEmailOptions } from './email-provider.interface';

export interface SendGridConfig {
  apiKey: string;
}

/** Parse "Name <email>" or plain email into { email, name? } */
function parseFromAddress(from: string): { email: string; name?: string } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: from.trim() };
}

export class SendGridProvider implements EmailProvider {
  constructor(
    private config: SendGridConfig,
    private defaultFrom: string,
  ) {}

  async send(options: SendEmailOptions): Promise<void> {
    const from = parseFromAddress(options.from || this.defaultFrom);

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from,
        subject: options.subject,
        content: [{ type: 'text/html', value: options.html }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SendGrid error ${response.status}: ${body}`);
    }
  }

  async verify(): Promise<boolean> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/user/credits', {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
