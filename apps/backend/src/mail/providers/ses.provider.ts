import { EmailProvider, SendEmailOptions } from './email-provider.interface';

export interface SesConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export class SesProvider implements EmailProvider {
  private client: any = null;

  constructor(
    private config: SesConfig,
    private defaultFrom: string,
  ) {}

  private async getClient() {
    if (this.client) return this.client;
    // Dynamic import to avoid requiring @aws-sdk/client-ses when not using SES
    const { SESClient } = await import('@aws-sdk/client-ses');
    this.client = new SESClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
    return this.client;
  }

  async send(options: SendEmailOptions): Promise<void> {
    const { SendEmailCommand } = await import('@aws-sdk/client-ses');
    const client = await this.getClient();

    await client.send(
      new SendEmailCommand({
        Source: options.from || this.defaultFrom,
        Destination: { ToAddresses: [options.to] },
        Message: {
          Subject: { Data: options.subject, Charset: 'UTF-8' },
          Body: { Html: { Data: options.html, Charset: 'UTF-8' } },
        },
      }),
    );
  }

  async verify(): Promise<boolean> {
    try {
      const { GetIdentityVerificationAttributesCommand } = await import('@aws-sdk/client-ses');
      const client = await this.getClient();
      // Simple API call to verify credentials work
      await client.send(new GetIdentityVerificationAttributesCommand({ Identities: [] }));
      return true;
    } catch {
      return false;
    }
  }
}
