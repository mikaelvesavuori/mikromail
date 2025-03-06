import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import net from 'node:net';
import os from 'node:os';
import tls from 'node:tls';

import type {
  AuthMethod,
  EmailOptions,
  SMTPConfiguration,
  SendResult
} from './interfaces';

import { encodeQuotedPrintable, validateEmail } from './utils';

/**
 * Enhanced SMTP client for sending emails without dependencies
 * Supports HTML content, improved security and comprehensive error handling
 */
export class SMTPClient {
  private config: Required<SMTPConfiguration>;
  private socket: tls.TLSSocket | net.Socket | null;
  private connected: boolean;
  private lastCommand: string;
  private serverCapabilities: string[];
  private secureMode: boolean;
  private retryCount: number;
  private readonly maxEmailSize = 10485760; // 10MB

  constructor(config: SMTPConfiguration) {
    this.config = {
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port ?? (config.secure ? 465 : 587),
      secure: config.secure ?? true,
      debug: config.debug ?? false,
      timeout: config.timeout ?? 10000,
      clientName: config.clientName ?? os.hostname(),
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      skipAuthentication: config.skipAuthentication || false
    };

    this.socket = null;
    this.connected = false;
    this.lastCommand = '';
    this.serverCapabilities = [];
    this.secureMode = this.config.secure;
    this.retryCount = 0;
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string, isError = false): void {
    if (this.config.debug) {
      const prefix = isError ? 'SMTP ERROR: ' : 'SMTP: ';
      console.log(`${prefix}${message}`);
    }
  }

  /**
   * Connect to the SMTP server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${this.config.timeout}ms`));
        this.socket?.destroy();
      }, this.config.timeout);

      try {
        if (this.config.secure) {
          // Direct TLS connection (implicit TLS, usually port 465)
          this.createTLSConnection(connectionTimeout, resolve, reject);
        } else {
          // Plain connection first, will upgrade with STARTTLS if supported (usually port 587)
          this.createPlainConnection(connectionTimeout, resolve, reject);
        }
      } catch (error) {
        clearTimeout(connectionTimeout);
        this.log(`Failed to create socket: ${(error as Error).message}`, true);
        reject(error);
      }
    });
  }

  /**
   * Create a secure TLS connection
   */
  private createTLSConnection(
    connectionTimeout: NodeJS.Timeout,
    resolve: () => void,
    reject: (reason: Error) => void
  ): void {
    // Create TLS socket with improved security options
    this.socket = tls.connect({
      host: this.config.host,
      port: this.config.port,
      rejectUnauthorized: true, // Always validate TLS certificates
      minVersion: 'TLSv1.2', // Enforce TLS 1.2 or higher
      ciphers: 'HIGH:!aNULL:!MD5:!RC4'
    });

    this.setupSocketEventHandlers(connectionTimeout, resolve, reject);
  }

  /**
   * Create a plain socket connection (for later STARTTLS upgrade)
   */
  private createPlainConnection(
    connectionTimeout: NodeJS.Timeout,
    resolve: () => void,
    reject: (reason: Error) => void
  ): void {
    this.socket = net.createConnection({
      host: this.config.host,
      port: this.config.port
    });

    this.setupSocketEventHandlers(connectionTimeout, resolve, reject);
  }

  /**
   * Set up common socket event handlers
   */
  private setupSocketEventHandlers(
    connectionTimeout: NodeJS.Timeout,
    resolve: () => void,
    reject: (reason: Error) => void
  ): void {
    if (!this.socket) return;

    // Handle connection errors
    this.socket.once('error', (err) => {
      clearTimeout(connectionTimeout);
      this.log(`Connection error: ${err.message}`, true);
      reject(new Error(`SMTP connection error: ${err.message}`));
    });

    // Handle successful connection
    this.socket.once('connect', () => {
      this.log('Connected to SMTP server');
      clearTimeout(connectionTimeout);

      // Wait for server greeting
      this.socket!.once('data', (data) => {
        const greeting = data.toString().trim();
        this.log(`Server greeting: ${greeting}`);

        if (greeting.startsWith('220')) {
          this.connected = true;
          this.secureMode = this.config.secure;
          resolve();
        } else {
          reject(new Error(`Unexpected server greeting: ${greeting}`));
          this.socket!.destroy();
        }
      });
    });

    // Handle unexpected socket close
    this.socket.once('close', (hadError) => {
      if (this.connected) {
        this.log(`Connection closed${hadError ? ' with error' : ''}`);
      } else {
        clearTimeout(connectionTimeout);
        reject(new Error('Connection closed before initialization completed'));
      }
      this.connected = false;
    });
  }

  /**
   * Upgrade connection to TLS using STARTTLS
   */
  private async upgradeToTLS(): Promise<void> {
    if (!this.socket || this.secureMode) return;

    return new Promise((resolve, reject) => {
      const plainSocket = this.socket as net.Socket;

      // Create a new TLS socket by upgrading the existing plain socket
      const tlsOptions = {
        socket: plainSocket,
        host: this.config.host,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        ciphers: 'HIGH:!aNULL:!MD5:!RC4'
      };

      // @ts-ignore
      const tlsSocket = tls.connect(tlsOptions);

      tlsSocket.once('error', (err) => {
        this.log(`TLS upgrade error: ${err.message}`, true);
        reject(new Error(`STARTTLS error: ${err.message}`));
      });

      tlsSocket.once('secureConnect', () => {
        this.log('Connection upgraded to TLS');

        if (tlsSocket.authorized) {
          this.socket = tlsSocket;
          this.secureMode = true;
          resolve();
        } else {
          reject(
            new Error(
              `TLS certificate verification failed: ${tlsSocket.authorizationError}`
            )
          );
        }
      });
    });
  }

  /**
   * Send an SMTP command and await response
   */
  async sendCommand(
    command: string,
    expectedCode: number,
    timeout = this.config.timeout
  ): Promise<string> {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to SMTP server');
    }

    return new Promise((resolve, reject) => {
      const commandTimeout = setTimeout(() => {
        this.socket?.removeListener('data', onData);
        reject(new Error(`Command timeout after ${timeout}ms: ${command}`));
      }, timeout);

      let responseData = '';

      const onData = (chunk: Buffer) => {
        responseData += chunk.toString();

        // Check for multiline responses that end with <code><space>
        // Complete SMTP responses end with <CR><LF>
        const lines = responseData.split('\r\n');
        if (lines.length > 0 && lines[lines.length - 1] === '') {
          const lastLine = lines[lines.length - 2] || '';
          const matches = /^(\d{3})(.?)/.exec(lastLine);

          if (matches?.[1] && matches[2] !== '-') {
            // We have a complete response
            this.socket?.removeListener('data', onData);
            clearTimeout(commandTimeout);

            this.log(`SMTP Response: ${responseData.trim()}`);

            // Check if the response code matches the expected code
            if (matches[1] === expectedCode.toString()) {
              resolve(responseData.trim());
            } else {
              reject(new Error(`SMTP Error: ${responseData.trim()}`));
            }
          }
        }
      };

      this.socket!.on('data', onData);

      // Don't log sensitive information
      if (
        command.startsWith('AUTH PLAIN') ||
        command.startsWith('AUTH LOGIN') ||
        (this.lastCommand === 'AUTH LOGIN' && !command.startsWith('AUTH'))
      ) {
        this.log('SMTP Command: [Credentials hidden]');
      } else {
        this.log(`SMTP Command: ${command}`);
      }

      this.lastCommand = command;
      this.socket!.write(`${command}\r\n`);
    });
  }

  /**
   * Parse EHLO response to determine server capabilities
   */
  private parseCapabilities(ehloResponse: string): void {
    const lines = ehloResponse.split('\r\n');
    this.serverCapabilities = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^\d{3}/) && line.charAt(3) === ' ') {
        const capability = line.substr(4).toUpperCase();
        this.serverCapabilities.push(capability);
      }
    }

    this.log(`Server capabilities: ${this.serverCapabilities.join(', ')}`);
  }

  /**
   * Determine the best authentication method supported by the server
   */
  private getBestAuthMethod(): AuthMethod {
    const capabilities = this.serverCapabilities.map(
      (cap) => cap.split(' ')[0]
    );

    if (capabilities.includes('AUTH')) {
      const authLine = this.serverCapabilities.find((cap) =>
        cap.startsWith('AUTH ')
      );
      if (authLine) {
        const methods = authLine.split(' ').slice(1);

        // Prefer more secure methods
        if (methods.includes('CRAM-MD5')) return 'CRAM-MD5';
        if (methods.includes('LOGIN')) return 'LOGIN';
        if (methods.includes('PLAIN')) return 'PLAIN';
      }
    }

    // Default to PLAIN if we couldn't determine
    return 'PLAIN';
  }

  /**
   * Authenticate with the SMTP server using the best available method
   */
  private async authenticate(): Promise<void> {
    const authMethod = this.getBestAuthMethod();

    switch (authMethod) {
      case 'CRAM-MD5':
        await this.authenticateCramMD5();
        break;

      case 'LOGIN':
        await this.authenticateLogin();
        break;

      default:
        await this.authenticatePlain();
        break;
    }
  }

  /**
   * Authenticate using PLAIN method
   */
  private async authenticatePlain(): Promise<void> {
    // PLAIN format is: \0username\0password (base64 encoded)
    const authPlain = Buffer.from(
      `\u0000${this.config.user}\u0000${this.config.password}`
    ).toString('base64');

    await this.sendCommand(`AUTH PLAIN ${authPlain}`, 235);
  }

  /**
   * Authenticate using LOGIN method
   */
  private async authenticateLogin(): Promise<void> {
    await this.sendCommand('AUTH LOGIN', 334);

    // Send username (base64 encoded)
    await this.sendCommand(
      Buffer.from(this.config.user).toString('base64'),
      334
    );

    // Send password (base64 encoded)
    await this.sendCommand(
      Buffer.from(this.config.password).toString('base64'),
      235
    );
  }

  /**
   * Authenticate using CRAM-MD5 method
   */
  private async authenticateCramMD5(): Promise<void> {
    // Request challenge
    const response = await this.sendCommand('AUTH CRAM-MD5', 334);

    // Extract challenge
    const challenge = Buffer.from(response.substr(4), 'base64').toString(
      'utf8'
    );

    // Calculate HMAC digest
    const hmac = crypto.createHmac('md5', this.config.password);
    hmac.update(challenge);
    const digest = hmac.digest('hex');

    // Send response in format: username space digest
    const cramResponse = `${this.config.user} ${digest}`;
    const encodedResponse = Buffer.from(cramResponse).toString('base64');

    await this.sendCommand(encodedResponse, 235);
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    const random = crypto.randomBytes(16).toString('hex');
    const domain = this.config.user.split('@')[1] || 'localhost';
    return `<${random}@${domain}>`;
  }

  /**
   * Generate MIME boundary for multipart messages
   */
  private generateBoundary(): string {
    return `----=_NextPart_${crypto.randomBytes(12).toString('hex')}`;
  }

  /**
   * Encode string according to RFC 2047 for headers with non-ASCII characters
   */
  private encodeHeaderValue(value: string): string {
    // Check if we need encoding (contains non-ASCII characters)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
    if (/^[\x00-\x7F]*$/.test(value)) {
      return value;
    }

    // Encode as quoted-printable
    return `=?UTF-8?Q?${
      // biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
      value.replace(/[^\x00-\x7F]/g, (c) => {
        const hex = c.charCodeAt(0).toString(16).toUpperCase();
        return `=${hex.length < 2 ? `0${hex}` : hex}`;
      })
    }?=`;
  }

  /**
   * Sanitize and encode header value to prevent injection and handle internationalization
   */
  private sanitizeHeader(value: string): string {
    // Replace newlines and carriage returns to prevent header injection
    const sanitized = value
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return this.encodeHeaderValue(sanitized);
  }

  /**
   * Create email headers with proper sanitization
   */
  private createEmailHeaders(options: EmailOptions): string[] {
    const messageId = this.generateMessageId();
    const date = new Date().toUTCString();

    // Process email addresses
    const from = options.from || this.config.user;
    const { to } = options;

    // Common headers with sanitization
    const headers = [
      `From: ${this.sanitizeHeader(from)}`,
      `To: ${this.sanitizeHeader(to)}`,
      `Subject: ${this.sanitizeHeader(options.subject)}`,
      `Message-ID: ${messageId}`,
      `Date: ${date}`,
      'MIME-Version: 1.0'
    ];

    // Optional headers
    if (options.cc) {
      const cc = Array.isArray(options.cc) ? options.cc.join(', ') : options.cc;
      headers.push(`Cc: ${this.sanitizeHeader(cc)}`);
    }

    if (options.replyTo) {
      headers.push(`Reply-To: ${this.sanitizeHeader(options.replyTo)}`);
    }

    // Add custom headers if provided
    if (options.headers) {
      for (const [name, value] of Object.entries(options.headers)) {
        // Skip any headers that could cause injection
        if (!/^[a-zA-Z0-9-]+$/.test(name)) continue;
        if (/^(from|to|cc|bcc|subject|date|message-id)$/i.test(name)) continue;

        headers.push(`${name}: ${this.sanitizeHeader(value)}`);
      }
    }

    return headers;
  }

  /**
   * Create a multipart email with text and HTML parts
   */
  private createMultipartEmail(options: EmailOptions): string {
    const { text, html } = options;
    const headers = this.createEmailHeaders(options);
    const boundary = this.generateBoundary();

    if (html && text) {
      // Multipart alternative for both HTML and text
      headers.push(
        `Content-Type: multipart/alternative; boundary="${boundary}"`
      );

      return `${headers.join('\r\n')}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${encodeQuotedPrintable(text || '')}\r\n\r\n--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${encodeQuotedPrintable(html || '')}\r\n\r\n--${boundary}--\r\n`;
    }
    if (html) {
      // HTML only
      headers.push('Content-Type: text/html; charset=utf-8');
      headers.push('Content-Transfer-Encoding: quoted-printable');

      return `${headers.join('\r\n')}\r\n\r\n${encodeQuotedPrintable(html)}`;
    }
    // Plain text only
    headers.push('Content-Type: text/plain; charset=utf-8');
    headers.push('Content-Transfer-Encoding: quoted-printable');

    return `${headers.join('\r\n')}\r\n\r\n${encodeQuotedPrintable(text || '')}`;
  }

  /**
   * Perform full SMTP handshake, including STARTTLS if needed
   */
  private async smtpHandshake(): Promise<void> {
    // Initial EHLO
    const ehloResponse = await this.sendCommand(
      `EHLO ${this.config.clientName}`,
      250
    );
    this.parseCapabilities(ehloResponse);

    // Check if we need to upgrade to TLS via STARTTLS
    if (!this.secureMode && this.serverCapabilities.includes('STARTTLS')) {
      await this.sendCommand('STARTTLS', 220);
      await this.upgradeToTLS();

      // After STARTTLS, we need to EHLO again
      const secureEhloResponse = await this.sendCommand(
        `EHLO ${this.config.clientName}`,
        250
      );
      this.parseCapabilities(secureEhloResponse);
    }

    // Only authenticate if skipAuthentication is not set to true
    // This allows testing with servers that don't require authentication
    if (!(this.config as any).skipAuthentication) {
      // Authenticate using the best method
      await this.authenticate();
    } else {
      this.log('Authentication skipped (testing mode)');
    }
  }

  /**
   * Send an email with retry capability
   */
  async sendEmail(options: EmailOptions): Promise<SendResult> {
    // Validate parameters
    const from = options.from || this.config.user;
    const { to, subject } = options;
    const text = options.text || '';
    const html = options.html || '';

    // Validate required fields
    if (!from || !to || !subject || (!text && !html)) {
      return {
        success: false,
        error:
          'Missing required email parameters (from, to, subject, and either text or html)'
      };
    }

    // Validate email addresses
    if (!validateEmail(from) || !validateEmail(to)) {
      return {
        success: false,
        error: 'Invalid email address format'
      };
    }

    // Try sending with retries for transient errors
    for (
      this.retryCount = 0;
      this.retryCount <= this.config.maxRetries;
      this.retryCount++
    ) {
      try {
        if (this.retryCount > 0) {
          this.log(
            `Retrying email send (attempt ${this.retryCount} of ${this.config.maxRetries})...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelay)
          );
        }

        // Connect if not already connected
        if (!this.connected) {
          await this.connect();
          await this.smtpHandshake();
        }

        // Set sender and recipient
        await this.sendCommand(`MAIL FROM:<${from}>`, 250);
        await this.sendCommand(`RCPT TO:<${to}>`, 250);

        // Add CC recipients to RCPT commands
        if (options.cc) {
          const ccList = Array.isArray(options.cc) ? options.cc : [options.cc];
          for (const cc of ccList) {
            if (validateEmail(cc)) {
              await this.sendCommand(`RCPT TO:<${cc}>`, 250);
            }
          }
        }

        // Add BCC recipients to RCPT commands (but not to headers)
        if (options.bcc) {
          const bccList = Array.isArray(options.bcc)
            ? options.bcc
            : [options.bcc];
          for (const bcc of bccList) {
            if (validateEmail(bcc)) {
              await this.sendCommand(`RCPT TO:<${bcc}>`, 250);
            }
          }
        }

        // Send email data
        await this.sendCommand('DATA', 354);

        // Create email content with text and/or HTML
        const emailContent = this.createMultipartEmail(options);
        if (emailContent.length > this.maxEmailSize) {
          return {
            success: false,
            error: 'Email size exceeds maximum allowed'
          };
        }

        // Send content and finalize with a single dot
        await this.sendCommand(`${emailContent}\r\n.`, 250);

        // Extract message ID from the content
        const messageIdMatch = /Message-ID: (.*)/i.exec(emailContent);
        const messageId = messageIdMatch ? messageIdMatch[1].trim() : undefined;

        return {
          success: true,
          messageId,
          message: 'Email sent successfully'
        };
      } catch (error) {
        const errorMessage = (error as Error).message;
        this.log(`Error sending email: ${errorMessage}`, true);

        // Don't retry certain permanent errors
        const isPermanentError =
          errorMessage.includes('5.') || // 5xx SMTP errors are permanent
          errorMessage.includes('Authentication failed') ||
          errorMessage.includes('certificate');

        if (isPermanentError || this.retryCount >= this.config.maxRetries) {
          return {
            success: false,
            error: errorMessage
          };
        }

        // For transient errors, close connection before retry
        try {
          if (this.connected) {
            await this.sendCommand('RSET', 250);
          }
        } catch (_error) {
          // Ignore errors during reset
        }

        this.socket?.end();
        this.connected = false;
      }
    }

    // This should never be reached due to the return in the loop
    return {
      success: false,
      error: 'Maximum retry count exceeded'
    };
  }

  /**
   * Close the connection gracefully
   */
  async close(): Promise<void> {
    try {
      if (this.connected) {
        await this.sendCommand('QUIT', 221);
      }
    } catch (e) {
      this.log(`Error during QUIT: ${(e as Error).message}`, true);
    } finally {
      if (this.socket) {
        this.socket.destroy();
        this.socket = null;
        this.connected = false;
      }
    }
  }
}
