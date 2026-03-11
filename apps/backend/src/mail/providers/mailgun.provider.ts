import { EmailProvider, SendEmailOptions } from './email-provider.interface';

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  region?: 'us' | 'eu';
}

export class MailgunProvider implements EmailProvider {
  constructor(
    private config: MailgunConfig,
    private defaultFrom: string,
  ) {}

  private get baseUrl(): string {
    const host = this.config.region === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
    return `https://${host}/v3/${this.config.domain}`;
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`api:${this.config.apiKey}`).toString('base64')}`;
  }

  async send(options: SendEmailOptions): Promise<void> {
    const formData = new URLSearchParams();
    formData.append('from', options.from || this.defaultFrom);
    formData.append('to', options.to);
    formData.append('subject', options.subject);
    formData.append('html', options.html);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: { Authorization: this.authHeader },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mailgun error ${response.status}: ${body}`);
    }
  }

  async verify(): Promise<boolean> {
    try {
      const host = this.config.region === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
      const response = await fetch(`https://${host}/v3/domains/${this.config.domain}`, {
        headers: { Authorization: this.authHeader },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
