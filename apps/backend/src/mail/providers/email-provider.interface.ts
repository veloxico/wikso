export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface EmailProvider {
  /** Send a single email */
  send(options: SendEmailOptions): Promise<void>;
  /** Test provider connection / credentials */
  verify(): Promise<boolean>;
}

export interface ProviderFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export type EmailProviderType = 'smtp' | 'sendgrid' | 'ses' | 'resend' | 'mailgun' | 'postmark' | 'mandrill';
