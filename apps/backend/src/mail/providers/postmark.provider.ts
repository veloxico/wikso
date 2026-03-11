import { EmailProvider, SendEmailOptions } from './email-provider.interface';

export interface PostmarkConfig {
  serverToken: string;
}

export class PostmarkProvider implements EmailProvider {
  constructor(
    private config: PostmarkConfig,
    private defaultFrom: string,
  ) {}

  async send(options: SendEmailOptions): Promise<void> {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': this.config.serverToken,
      },
      body: JSON.stringify({
        From: options.from || this.defaultFrom,
        To: options.to,
        Subject: options.subject,
        HtmlBody: options.html,
        MessageStream: 'outbound',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Postmark error ${response.status}: ${body}`);
    }
  }

  async verify(): Promise<boolean> {
    try {
      const response = await fetch('https://api.postmarkapp.com/server', {
        headers: {
          Accept: 'application/json',
          'X-Postmark-Server-Token': this.config.serverToken,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
