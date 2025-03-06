/**
 * Configuration options for SMTP client.
 */
export interface SMTPConfiguration {
  user: string;
  password: string;
  host: string;
  port?: number;
  secure?: boolean;
  timeout?: number;
  debug?: boolean;
  clientName?: string;
  maxRetries?: number;
  retryDelay?: number;
  skipAuthentication?: boolean; // Skip authentication step (for test servers)
}

/**
 * Email sending options.
 */
export interface EmailOptions {
  from?: string;
  to: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
  headers?: Record<string, string>;
}

/**
 * Email attachment definition.
 */
export interface Attachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  encoding?: 'base64' | 'hex' | 'binary';
}

/**
 * Result of email sending operation.
 */
export interface SendResult {
  success: boolean;
  messageId?: string;
  message?: string;
  error?: string;
}

/**
 * Supported authentication methods.
 */
export type AuthMethod = 'PLAIN' | 'LOGIN' | 'CRAM-MD5';

export type ConfigurationOptions = {
  config?: SMTPConfiguration;
  configFilePath?: string;
  args?: string[];
};
