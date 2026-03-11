import * as nodemailer from 'nodemailer';
import { EmailProvider, SendEmailOptions } from './email-provider.interface';

export interface SmtpConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  secure?: boolean;
}

export class SmtpProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;

  constructor(
    private config: SmtpConfig,
    private defaultFrom: string,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      ...(config.username && config.password
        ? { auth: { user: config.username, pass: config.password } }
        : {}),
    });
  }

  async send(options: SendEmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: options.from || this.defaultFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
