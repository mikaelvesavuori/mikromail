import type { ConfigurationOptions, EmailOptions } from './interfaces/index.js';

import { Configuration } from './Configuration.js';
import { SMTPClient } from './SMTPClient.js';
import { verifyEmailDomain } from './utils/index.js';

/**
 * @description Lightweight replacement for Nodemailer, supporting HTML, international symbols, and more.
 * @example
 * const config = {
 *   user: 'me@mydomain.com',
 *   password: 'YOUR_PASSWORD_HERE',
 *   host: 'smtp.email-provider.com'
 * };
 *
 * const emailOptions = {
 *   from: 'me@mydomain.com',
 *   subject: 'Test Email',
 *   text: 'Hello!',
 *   to: 'you@yourdomain.com'
 * };
 *
 * await new MikroMail({ config }).send(emailOptions);
 */
export class MikroMail {
  private readonly smtpClient: SMTPClient;

  constructor(options?: ConfigurationOptions) {
    const config = new Configuration(options).get();

    const smtpClient = new SMTPClient(config);

    this.smtpClient = smtpClient;
  }

  /**
   * Sends an email to valid domains.
   */
  public async send(emailOptions: EmailOptions) {
    try {
      const recipients = Array.isArray(emailOptions.to)
        ? emailOptions.to
        : [emailOptions.to];

      for (const recipient of recipients) {
        const hasMXRecords = await verifyEmailDomain(recipient);
        if (!hasMXRecords)
          console.error(
            `Warning: No MX records found for recipient domain: ${recipient}`
          );
      }

      const result = await this.smtpClient.sendEmail(emailOptions);

      if (result.success) console.log(`Message ID: ${result.messageId}`);
      else console.error(`Failed to send email: ${result.error}`);

      await this.smtpClient.close();
    } catch (error) {
      console.error(
        'Error in email sending process:',
        (error as Error).message
      );
    }
  }
}
