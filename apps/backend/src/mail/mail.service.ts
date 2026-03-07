import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const host = process.env.MAIL_HOST || process.env.SMTP_HOST || 'localhost';
    const port = parseInt(process.env.MAIL_PORT || process.env.SMTP_PORT || '587');
    const user = process.env.MAIL_USER || process.env.SMTP_USER;
    const pass = process.env.MAIL_PASS || process.env.SMTP_PASS;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  private async send(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_FROM || 'noreply@example.com',
        to,
        subject,
        html,
      });
    } catch (err) {
      this.logger.warn(`Failed to send email to ${to}: ${err.message}`);
    }
  }

  async sendVerificationEmail(email: string, name: string, token: string) {
    const url = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;
    await this.send(email, 'Verify your email', `
      <h2>Hello ${name}!</h2>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${url}">${url}</a>
    `);
  }

  async sendPasswordResetEmail(email: string, name: string, token: string) {
    const url = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
    await this.send(email, 'Reset your password', `
      <h2>Hello ${name}!</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${url}">${url}</a>
    `);
  }

  async sendCommentNotification(email: string, name: string, pageTitle: string, commenterName: string) {
    await this.send(email, `New comment on "${pageTitle}"`, `
      <h2>Hello ${name}!</h2>
      <p>${commenterName} commented on "${pageTitle}".</p>
    `);
  }

  async sendMentionNotification(email: string, name: string, pageTitle: string, mentionerName: string) {
    await this.send(email, `You were mentioned in "${pageTitle}"`, `
      <h2>Hello ${name}!</h2>
      <p>${mentionerName} mentioned you in "${pageTitle}".</p>
    `);
  }
}
