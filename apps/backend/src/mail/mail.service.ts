import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @Optional() @InjectQueue('emails') private emailsQueue?: Queue,
  ) {
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
    // If BullMQ queue is available, enqueue for async processing
    if (this.emailsQueue) {
      try {
        await this.emailsQueue.add('send', { to, subject, html }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        });
        return;
      } catch (err) {
        this.logger.warn(`Failed to enqueue email to ${to}: ${err.message}`);
        // Fall through to synchronous send
      }
    }

    // Fallback: send synchronously
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

  async sendInvitationEmail(email: string, name: string, token: string) {
    const url = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/accept-invite?token=${token}`;
    await this.send(email, 'You have been invited to Dokka', `
      <h2>Hello ${name}!</h2>
      <p>You have been invited to join Dokka — a modern wiki & knowledge base.</p>
      <p>Click the link below to set up your password and get started:</p>
      <a href="${url}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Accept Invitation</a>
      <p style="margin-top:16px;color:#888;">Or copy this URL: ${url}</p>
      <p style="color:#888;">This invitation will expire in 7 days.</p>
    `);
  }
}
