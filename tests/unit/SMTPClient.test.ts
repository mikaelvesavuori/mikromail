import { describe, expect, test } from 'vitest';

import type {
  EmailOptions,
  SMTPConfiguration
} from '../../src/interfaces/index.js';

import { SMTPClient } from '../../src/SMTPClient.js';

const BASE_CONFIG: SMTPConfiguration = {
  host: 'smtp.test.com',
  user: 'testuser@test.com',
  password: 'testpass',
  port: 1025,
  secure: false,
  skipAuthentication: true
};

describe('Email validation with skipEmailValidation', () => {
  test('It should reject invalid email addresses by default', async () => {
    const client = new SMTPClient(BASE_CONFIG);

    const emailOptions: EmailOptions = {
      from: 'sender@example.com',
      to: 'not-an-email',
      subject: 'Test',
      text: 'Test email'
    };

    const result = await client.sendEmail(emailOptions);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid recipient email address format');

    await client.close();
  });

  test('It should reject invalid from address by default', async () => {
    const client = new SMTPClient(BASE_CONFIG);

    const emailOptions: EmailOptions = {
      from: 'not-an-email',
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Test email'
    };

    const result = await client.sendEmail(emailOptions);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid email address format');

    await client.close();
  });

  test('It should accept non-email formats when skipEmailValidation is true', async () => {
    const client = new SMTPClient({
      ...BASE_CONFIG,
      skipEmailValidation: true
    });

    const emailOptions: EmailOptions = {
      from: 'sender@example.com',
      to: 'a1b2c3d4e5f6g7', // Test provider ID
      subject: 'Test',
      text: 'Test email'
    };

    // This should not fail validation (though it will fail to connect since we're not testing actual SMTP)
    // We're checking that validation is skipped, not that the email sends successfully
    const result = await client.sendEmail(emailOptions);

    // The error should be connection-related, not validation-related
    if (!result.success) {
      expect(result.error).not.toContain(
        'Invalid recipient email address format'
      );
      expect(result.error).not.toContain('Invalid email address format');
    }

    await client.close();
  });

  test('It should accept multiple non-email recipient formats when skipEmailValidation is true', async () => {
    const client = new SMTPClient({
      ...BASE_CONFIG,
      skipEmailValidation: true
    });

    const emailOptions: EmailOptions = {
      from: 'sender@example.com',
      to: ['test-id-123', 'test-id-456', 'test-id-789'],
      subject: 'Test',
      text: 'Test email'
    };

    const result = await client.sendEmail(emailOptions);

    // The error should be connection-related, not validation-related
    if (!result.success) {
      expect(result.error).not.toContain(
        'Invalid recipient email address format'
      );
      expect(result.error).not.toContain('Invalid email address format');
    }

    await client.close();
  });

  test('It should still validate email format is proper emails when skipEmailValidation is false', async () => {
    const client = new SMTPClient({
      ...BASE_CONFIG,
      skipEmailValidation: false
    });

    const emailOptions: EmailOptions = {
      from: 'sender@example.com',
      to: 'recipient',
      subject: 'Test',
      text: 'Test email'
    };

    const result = await client.sendEmail(emailOptions);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid recipient email address format');

    await client.close();
  });
});

describe('SMTPClient configuration initialization', () => {
  test('It should set skipEmailValidation to false by default', () => {
    const client = new SMTPClient(BASE_CONFIG);

    expect((client as any).config.skipEmailValidation).toBe(false);
  });

  test('It should set skipMXRecordCheck to false by default', () => {
    const client = new SMTPClient(BASE_CONFIG);

    expect((client as any).config.skipMXRecordCheck).toBe(false);
  });

  test('It should respect skipEmailValidation when set to true', () => {
    const client = new SMTPClient({
      ...BASE_CONFIG,
      skipEmailValidation: true
    });

    expect((client as any).config.skipEmailValidation).toBe(true);
  });

  test('It should respect skipMXRecordCheck when set to true', () => {
    const client = new SMTPClient({
      ...BASE_CONFIG,
      skipMXRecordCheck: true
    });

    expect((client as any).config.skipMXRecordCheck).toBe(true);
  });
});
