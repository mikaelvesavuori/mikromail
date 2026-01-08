import { describe, expect, test } from 'vitest';

import type { SMTPConfiguration } from '../../src/interfaces/index.js';

import { MikroMail } from '../../src/MikroMail.js';

const BASE_CONFIG: SMTPConfiguration = {
  host: 'localhost',
  user: 'testuser@test.com',
  password: 'testpass',
  port: 1025,
  secure: false,
  skipAuthentication: true
};

describe('MikroMail skipMXRecordCheck functionality', () => {
  test('It should initialize with skipMXRecordCheck set to false by default', () => {
    const mikroMail = new MikroMail({ config: BASE_CONFIG });

    expect((mikroMail as any).config.skipMXRecordCheck).toBe(false);
  });

  test('It should initialize with skipMXRecordCheck set to true when configured', () => {
    const mikroMail = new MikroMail({
      config: {
        ...BASE_CONFIG,
        skipMXRecordCheck: true
      }
    });

    expect((mikroMail as any).config.skipMXRecordCheck).toBe(true);
  });

  test('It should initialize with skipEmailValidation set to false by default', () => {
    const mikroMail = new MikroMail({ config: BASE_CONFIG });

    expect((mikroMail as any).config.skipEmailValidation).toBe(false);
  });

  test('It should initialize with skipEmailValidation set to true when configured', () => {
    const mikroMail = new MikroMail({
      config: {
        ...BASE_CONFIG,
        skipEmailValidation: true
      }
    });

    expect((mikroMail as any).config.skipEmailValidation).toBe(true);
  });

  test('It should support both skip options simultaneously', () => {
    const mikroMail = new MikroMail({
      config: {
        ...BASE_CONFIG,
        skipEmailValidation: true,
        skipMXRecordCheck: true
      }
    });

    expect((mikroMail as any).config.skipEmailValidation).toBe(true);
    expect((mikroMail as any).config.skipMXRecordCheck).toBe(true);
  });
});

describe('MikroMail configuration options', () => {
  test('It should accept configuration for test providers', () => {
    const testProviderConfig: SMTPConfiguration = {
      host: 'smtp.mailtrap.io',
      user: 'mailtrapuser',
      password: 'mailtrappass',
      port: 587,
      secure: false,
      skipEmailValidation: true,
      skipMXRecordCheck: true
    };

    const mikroMail = new MikroMail({ config: testProviderConfig });

    expect((mikroMail as any).config.host).toBe('smtp.mailtrap.io');
    expect((mikroMail as any).config.port).toBe(587);
    expect((mikroMail as any).config.secure).toBe(false);
    expect((mikroMail as any).config.skipEmailValidation).toBe(true);
    expect((mikroMail as any).config.skipMXRecordCheck).toBe(true);
  });

  test('It should accept configuration for Proton Mail', () => {
    const protonConfig: SMTPConfiguration = {
      host: 'smtp.protonmail.ch',
      user: 'user@proton.me',
      password: 'apppassword',
      port: 465,
      secure: true
    };

    const mikroMail = new MikroMail({ config: protonConfig });

    expect((mikroMail as any).config.host).toBe('smtp.protonmail.ch');
    expect((mikroMail as any).config.port).toBe(465);
    expect((mikroMail as any).config.secure).toBe(true);
    expect((mikroMail as any).config.skipEmailValidation).toBe(false);
    expect((mikroMail as any).config.skipMXRecordCheck).toBe(false);
  });
});
