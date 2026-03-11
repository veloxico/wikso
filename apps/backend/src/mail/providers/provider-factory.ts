import { EmailProvider, EmailProviderType, ProviderFieldDefinition } from './email-provider.interface';
import { SmtpProvider, SmtpConfig } from './smtp.provider';
import { SendGridProvider, SendGridConfig } from './sendgrid.provider';
import { SesProvider, SesConfig } from './ses.provider';
import { ResendProvider, ResendConfig } from './resend.provider';
import { MailgunProvider, MailgunConfig } from './mailgun.provider';
import { PostmarkProvider, PostmarkConfig } from './postmark.provider';
import { MandrillProvider, MandrillConfig } from './mandrill.provider';

export interface ProviderInfo {
  type: EmailProviderType;
  name: string;
  description: string;
  docsUrl: string;
  fields: ProviderFieldDefinition[];
}

const PROVIDER_REGISTRY: Record<EmailProviderType, Omit<ProviderInfo, 'type'>> = {
  smtp: {
    name: 'SMTP',
    description: 'Standard SMTP server (Gmail, Outlook, custom SMTP)',
    docsUrl: 'https://support.google.com/a/answer/176600',
    fields: [
      { name: 'host', label: 'SMTP Host', type: 'text', required: true, placeholder: 'smtp.gmail.com' },
      { name: 'port', label: 'Port', type: 'number', required: true, placeholder: '587' },
      { name: 'username', label: 'Username', type: 'text', required: false, placeholder: 'user@gmail.com' },
      { name: 'password', label: 'Password', type: 'password', required: false },
      {
        name: 'secure', label: 'Security', type: 'select', required: false,
        options: [
          { label: 'Auto (based on port)', value: 'auto' },
          { label: 'TLS (port 465)', value: 'true' },
          { label: 'STARTTLS (port 587)', value: 'false' },
        ],
      },
    ],
  },
  sendgrid: {
    name: 'SendGrid',
    description: 'Twilio SendGrid email API',
    docsUrl: 'https://docs.sendgrid.com/ui/account-and-settings/api-keys',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'SG.xxxxx' },
    ],
  },
  ses: {
    name: 'Amazon SES',
    description: 'Amazon Simple Email Service',
    docsUrl: 'https://docs.aws.amazon.com/ses/latest/dg/setting-up.html',
    fields: [
      { name: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      {
        name: 'region', label: 'Region', type: 'select', required: true,
        options: [
          { label: 'US East (N. Virginia)', value: 'us-east-1' },
          { label: 'US West (Oregon)', value: 'us-west-2' },
          { label: 'EU (Ireland)', value: 'eu-west-1' },
          { label: 'EU (Frankfurt)', value: 'eu-central-1' },
          { label: 'Asia Pacific (Mumbai)', value: 'ap-south-1' },
          { label: 'Asia Pacific (Sydney)', value: 'ap-southeast-2' },
        ],
      },
    ],
  },
  resend: {
    name: 'Resend',
    description: 'Resend email API for developers',
    docsUrl: 'https://resend.com/docs/dashboard/api-keys/introduction',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 're_xxxxx' },
    ],
  },
  mailgun: {
    name: 'Mailgun',
    description: 'Mailgun email API',
    docsUrl: 'https://documentation.mailgun.com/docs/mailgun/quickstart/',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true },
      { name: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'mg.example.com' },
      {
        name: 'region', label: 'Region', type: 'select', required: false,
        options: [
          { label: 'US', value: 'us' },
          { label: 'EU', value: 'eu' },
        ],
      },
    ],
  },
  postmark: {
    name: 'Postmark',
    description: 'Postmark transactional email',
    docsUrl: 'https://postmarkapp.com/developer/api/overview',
    fields: [
      { name: 'serverToken', label: 'Server API Token', type: 'password', required: true },
    ],
  },
  mandrill: {
    name: 'Mandrill',
    description: 'Mailchimp Transactional Email (Mandrill)',
    docsUrl: 'https://mailchimp.com/developer/transactional/guides/quick-start/',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },
};

/**
 * Create an email provider instance from type and config.
 */
export function createProvider(
  type: EmailProviderType,
  config: Record<string, any>,
  defaultFrom: string,
): EmailProvider {
  switch (type) {
    case 'smtp':
      return new SmtpProvider(
        {
          host: config.host,
          port: parseInt(config.port) || 587,
          username: config.username,
          password: config.password,
          secure: config.secure === 'true' ? true : config.secure === 'false' ? false : undefined,
        } as SmtpConfig,
        defaultFrom,
      );

    case 'sendgrid':
      return new SendGridProvider({ apiKey: config.apiKey } as SendGridConfig, defaultFrom);

    case 'ses':
      return new SesProvider(
        {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          region: config.region || 'us-east-1',
        } as SesConfig,
        defaultFrom,
      );

    case 'resend':
      return new ResendProvider({ apiKey: config.apiKey } as ResendConfig, defaultFrom);

    case 'mailgun':
      return new MailgunProvider(
        {
          apiKey: config.apiKey,
          domain: config.domain,
          region: config.region || 'us',
        } as MailgunConfig,
        defaultFrom,
      );

    case 'postmark':
      return new PostmarkProvider({ serverToken: config.serverToken } as PostmarkConfig, defaultFrom);

    case 'mandrill':
      return new MandrillProvider({ apiKey: config.apiKey } as MandrillConfig, defaultFrom);

    default:
      throw new Error(`Unknown email provider: ${type}`);
  }
}

/**
 * Get list of all available providers with their field definitions.
 */
export function getAvailableProviders(): ProviderInfo[] {
  return Object.entries(PROVIDER_REGISTRY).map(([type, info]) => ({
    type: type as EmailProviderType,
    ...info,
  }));
}

/**
 * Get field definitions for a specific provider.
 */
export function getProviderFields(type: EmailProviderType): ProviderFieldDefinition[] {
  const info = PROVIDER_REGISTRY[type];
  if (!info) throw new Error(`Unknown provider: ${type}`);
  return info.fields;
}

/**
 * Mask sensitive field values for API responses.
 */
export function maskConfig(
  type: EmailProviderType,
  config: Record<string, any>,
): Record<string, any> {
  const fields = PROVIDER_REGISTRY[type]?.fields || [];
  const masked: Record<string, any> = {};
  for (const field of fields) {
    const value = config[field.name];
    if (field.type === 'password' && value) {
      masked[field.name] = value.length > 8
        ? value.substring(0, 4) + '••••' + value.substring(value.length - 4)
        : '••••••••';
    } else {
      masked[field.name] = value || '';
    }
  }
  return masked;
}

/**
 * Merge incoming config with existing config, preserving masked password fields.
 * When the frontend sends back a masked password (contains ••••), we keep the original value.
 */
export function mergeConfigWithExisting(
  type: EmailProviderType,
  incoming: Record<string, any>,
  existing: Record<string, any>,
): Record<string, any> {
  const fields = PROVIDER_REGISTRY[type]?.fields || [];
  const merged = { ...incoming };

  for (const field of fields) {
    if (field.type === 'password' && merged[field.name]) {
      // If the value contains masked characters, keep the original
      if (String(merged[field.name]).includes('••••')) {
        merged[field.name] = existing[field.name] || '';
      }
    }
  }

  return merged;
}
