import { EmailProvider, SendEmailOptions } from './email-provider.interface';

export interface ResendConfig {
  apiKey: string;
}

export class ResendProvider implements EmailProvider {
  constructor(
    private config: ResendConfig,
    private defaultFrom: string,
  ) {}

  async send(options: SendEmailOptions): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || this.defaultFrom,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend error ${response.status}: ${body}`);
    }
  }

  async verify(): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
