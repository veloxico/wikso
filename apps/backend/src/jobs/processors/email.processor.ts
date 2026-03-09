import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';

interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

@Processor('emails')
export class EmailProcessor extends WorkerHost {
  private logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    super();
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

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, html } = job.data;

    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_FROM || 'noreply@example.com',
        to,
        subject,
        html,
      });
    } catch (err) {
      this.logger.warn(`Failed to send email to ${to}: ${err.message}`);
      throw err; // Let BullMQ retry
    }
  }
}
