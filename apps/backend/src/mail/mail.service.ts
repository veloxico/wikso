import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SettingsService } from '../settings/settings.service';
import { EmailProvider, EmailProviderType } from './providers/email-provider.interface';
import { createProvider } from './providers/provider-factory';
import { SmtpProvider } from './providers/smtp.provider';
import { decrypt } from '../common/utils/encryption';

/** Escape user-controlled strings before inserting into HTML email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Sanitize user-controlled strings for use in email subjects (strip control chars). */
function sanitizeSubject(str: string): string {
  return str.replace(/[\r\n\t]/g, ' ').trim();
}

@Injectable()
export class MailService implements OnModuleInit {
  private logger = new Logger(MailService.name);
  private provider: EmailProvider | null = null;
  private defaultFrom: string = '';
  private providerType: string = '';

  constructor(
    private settingsService: SettingsService,
    @Optional() @InjectQueue('emails') private emailsQueue?: Queue,
  ) {}

  async onModuleInit() {
    await this.reloadProvider();
  }

  /**
   * Reload email provider from DB settings, falling back to env vars.
   * Called on startup and after admin saves email config.
   */
  async reloadProvider(): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings();

      // Priority 1: DB config
      if (settings.emailProvider && settings.emailProviderConfig) {
        try {
          const config = JSON.parse(decrypt(settings.emailProviderConfig));
          this.defaultFrom = settings.emailFromAddress || 'noreply@example.com';
          this.providerType = settings.emailProvider;
          this.provider = createProvider(
            settings.emailProvider as EmailProviderType,
            config,
            this.formatFrom(settings.emailFromName, this.defaultFrom),
          );
          this.logger.log(`Email provider loaded from DB: ${settings.emailProvider}`);
          return;
        } catch (err) {
          this.logger.warn(`Failed to load DB email config: ${err.message}`);
        }
      }

      // Priority 2: Env vars (SMTP)
      const host = process.env.MAIL_HOST || process.env.SMTP_HOST;
      if (host) {
        const port = parseInt(process.env.MAIL_PORT || process.env.SMTP_PORT || '587');
        const user = process.env.MAIL_USER || process.env.SMTP_USER;
        const pass = process.env.MAIL_PASS || process.env.SMTP_PASS;
        this.defaultFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || 'noreply@example.com';
        this.providerType = 'smtp (env)';

        this.provider = new SmtpProvider(
          { host, port, username: user, password: pass },
          this.defaultFrom,
        );
        this.logger.log(`Email provider loaded from env vars: SMTP → ${host}:${port}`);
        return;
      }

      // Priority 3: Disabled
      this.provider = null;
      this.providerType = '';
      this.logger.warn('No email provider configured. Emails will be skipped.');
    } catch (err) {
      this.logger.error(`Failed to initialize email provider: ${err.message}`);
      this.provider = null;
    }
  }

  /** Whether email sending is currently configured and available. */
  isConfigured(): boolean {
    return this.provider !== null;
  }

  /** Get current status for admin dashboard. */
  getStatus(): { configured: boolean; provider: string; fromAddress: string } {
    return {
      configured: this.provider !== null,
      provider: this.providerType,
      fromAddress: this.defaultFrom,
    };
  }

  /** Format "Name <email>" from address. */
  private formatFrom(name: string | undefined, email: string): string {
    if (name) return `${name} <${email}>`;
    return email;
  }

  /**
   * Send an email. Queues via BullMQ if available, otherwise sends directly.
   * Silently skips if no provider is configured.
   */
  private async send(to: string, subject: string, html: string) {
    if (!this.provider) {
      this.logger.debug(`Skipping email to ${to} — no provider configured`);
      return;
    }

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
    await this.sendDirect({ to, subject, html });
  }

  /**
   * Send email directly (bypasses queue). Used by EmailProcessor and fallback.
   */
  async sendDirect(data: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.provider) {
      this.logger.debug(`Skipping direct email to ${data.to} — no provider configured`);
      return;
    }

    try {
      await this.provider.send(data);
    } catch (err) {
      this.logger.warn(`Failed to send email to ${data.to}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Send a test email. Throws on failure so admin can see errors.
   */
  async sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
    if (!this.provider) {
      return { success: false, message: 'No email provider configured' };
    }

    try {
      await this.provider.send({
        to,
        subject: 'Wikso — Test Email',
        html: '<h2>Email configuration is working!</h2><p>This is a test email from Wikso admin panel.</p>',
      });
      return { success: true, message: `Test email sent to ${to}` };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Verify the current provider connection.
   */
  async verifyProvider(): Promise<boolean> {
    if (!this.provider) return false;
    try {
      return await this.provider.verify();
    } catch {
      return false;
    }
  }

  // ─── Email Templates ────────────────────────────────────

  async sendVerificationEmail(email: string, name: string, token: string) {
    const url = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;
    const safeName = escapeHtml(name);
    await this.send(email, 'Verify your email', `
      <h2>Hello ${safeName}!</h2>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${url}">${url}</a>
    `);
  }

  async sendPasswordResetEmail(email: string, name: string, token: string) {
    const url = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
    const safeName = escapeHtml(name);
    await this.send(email, 'Reset your password', `
      <h2>Hello ${safeName}!</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${url}">${url}</a>
    `);
  }

  async sendCommentNotification(email: string, name: string, pageTitle: string, commenterName: string) {
    const safeTitle = escapeHtml(pageTitle);
    const safeSubjectTitle = sanitizeSubject(pageTitle);
    await this.send(email, `New comment on "${safeSubjectTitle}"`, `
      <h2>Hello ${escapeHtml(name)}!</h2>
      <p>${escapeHtml(commenterName)} commented on &ldquo;${safeTitle}&rdquo;.</p>
    `);
  }

  async sendMentionNotification(email: string, name: string, pageTitle: string, mentionerName: string) {
    const safeTitle = escapeHtml(pageTitle);
    const safeSubjectTitle = sanitizeSubject(pageTitle);
    await this.send(email, `You were mentioned in "${safeSubjectTitle}"`, `
      <h2>Hello ${escapeHtml(name)}!</h2>
      <p>${escapeHtml(mentionerName)} mentioned you in &ldquo;${safeTitle}&rdquo;.</p>
    `);
  }

  async sendInvitationEmail(email: string, name: string, token: string) {
    const url = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/accept-invite?token=${token}`;
    const safeName = escapeHtml(name);
    await this.send(email, 'You have been invited to Wikso', `
      <h2>Hello ${safeName}!</h2>
      <p>You have been invited to join Wikso — a modern wiki & knowledge base.</p>
      <p>Click the link below to set up your password and get started:</p>
      <a href="${url}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Accept Invitation</a>
      <p style="margin-top:16px;color:#888;">Or copy this URL: ${url}</p>
      <p style="color:#888;">This invitation will expire in 7 days.</p>
    `);
  }
}
