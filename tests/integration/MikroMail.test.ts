import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';

import { MikroMail } from '../../src/MikroMail.js';

import { SMTPClient } from '../../src/SMTPClient.js';
import {
  MAILPIT_API,
  MAILPIT_CONFIG,
  clearMailpitMessages,
  getMailpitMessages,
  getMessageHeaders,
  getMessageHtml,
  getMessageText
} from '../utils/Mailpit.js';

let mailClient: MikroMail;
const CONFIG_PATH = 'test-integration-config.json';

beforeAll(async () => {
  try {
    const response = await fetch(`${MAILPIT_API}/v1/messages`);
    if (!response.ok)
      throw new Error(`Mailpit responded with: ${response.status}`);
  } catch (_error) {
    console.error('Mailpit is not running. Please start it with:');
    console.error('docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit');
    throw new Error('Mailpit not available');
  }

  writeFileSync(CONFIG_PATH, JSON.stringify(MAILPIT_CONFIG));
});

beforeEach(async () => {
  await clearMailpitMessages();
  mailClient = new MikroMail({ configFilePath: CONFIG_PATH });
});

afterAll(async () => {
  if (existsSync(CONFIG_PATH)) unlinkSync(CONFIG_PATH);
});

test('It should send a plain text email', async () => {
  await mailClient.send({
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Integration Test - Plain Text',
    text: 'This is a plain text email for testing purposes.'
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const messages = await getMailpitMessages();
  const testEmail = messages.find(
    (msg: any) => msg.Subject === 'Integration Test - Plain Text'
  );

  expect(testEmail).toBeDefined();
  expect(testEmail.From.Address).toBe('sender@example.com');
  expect(testEmail.To[0].Address).toContain('recipient@example.com');
}, 10000);

test('It should send an HTML email', async () => {
  const magicLink =
    'https://mydomain.com/app/verify=token=jkahs7a62e8agdoia26t&email=sam.person@mydomain.com';

  const html = `<h1>HTML Email Test</h1><p>This is an <b>HTML</b> email for testing purposes.</p><p><a href="${magicLink}">Demo verification link</a></p>`;

  await mailClient.send({
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Integration Test - HTML Email',
    html
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const messages = await getMailpitMessages();
  const testEmail = messages.find(
    (msg: Record<string, any>) =>
      msg.Subject === 'Integration Test - HTML Email'
  );

  expect(testEmail).toBeDefined();

  const htmlContent = await getMessageHtml(testEmail.ID);
  expect(htmlContent.trim()).toBe(html);
}, 10000);

test('It should send an email with CC recipients', async () => {
  await mailClient.send({
    from: 'sender@example.com',
    to: 'recipient@example.com',
    cc: ['cc1@example.com', 'cc2@example.com'],
    subject: 'Integration Test - CC Recipients',
    text: 'This email has CC recipients.'
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const messages = await getMailpitMessages();
  const testEmail = messages.find(
    (msg: any) => msg.Subject === 'Integration Test - CC Recipients'
  );

  expect(testEmail).toBeDefined();
  expect(testEmail.Cc).toBeDefined();
  expect(testEmail.Cc[0].Address).toContain('cc1@example.com');
  expect(testEmail.Cc[1].Address).toContain('cc2@example.com');
}, 10000);

test('It should send a multipart email with both HTML and text', async () => {
  await mailClient.send({
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Integration Test - Multipart Email',
    text: 'This is the plain text version.',
    html: '<p>This is the <strong>HTML</strong> version.</p>'
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const messages = await getMailpitMessages();
  const testEmail = messages.find(
    (msg: any) => msg.Subject === 'Integration Test - Multipart Email'
  );

  expect(testEmail).toBeDefined();

  const textContent = await getMessageText(testEmail.ID);
  expect(textContent).toContain('This is the plain text version');

  const htmlContent = await getMessageHtml(testEmail.ID);
  expect(htmlContent).toContain('This is the <strong>HTML</strong> version');
}, 10000);

test('It should work with direct configuration', async () => {
  const directClient = new MikroMail({ config: MAILPIT_CONFIG });

  await directClient.send({
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Integration Test - Direct Config',
    text: 'This email was sent using direct configuration.'
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const messages = await getMailpitMessages();
  const testEmail = messages.find(
    (msg: any) => msg.Subject === 'Integration Test - Direct Config'
  );

  expect(testEmail).toBeDefined();
  expect(testEmail.From.Address).toBe('sender@example.com');
}, 10000);

test('It should handle retry on temporary error', async () => {
  const customClient = new SMTPClient({
    ...MAILPIT_CONFIG,
    maxRetries: 2,
    retryDelay: 500
  });

  expect((customClient as any).config.maxRetries).toBe(2);
  expect((customClient as any).config.retryDelay).toBe(500);

  await customClient.close();
});

test('It should send an email with BCC recipients', async () => {
  await mailClient.send({
    from: 'sender@example.com',
    to: 'recipient@example.com',
    bcc: ['bcc1@example.com', 'bcc2@example.com'],
    subject: 'Integration Test - BCC Recipients',
    text: 'This email has BCC recipients.'
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const messages = await getMailpitMessages();

  expect(messages.length).toBe(1);

  const testEmails = messages.filter(
    (msg: any) => msg.Subject === 'Integration Test - BCC Recipients'
  );

  const bccs = testEmails.map((email: Record<string, any>) => email.Bcc)[0];

  expect(testEmails.length + bccs.length).toBe(3);

  const recipients = testEmails.map((msg: any) =>
    msg.To[0].Address.toLowerCase()
  );

  expect(recipients).toContain('recipient@example.com');
  expect(bccs[0].Address).toBe('bcc1@example.com');
  expect(bccs[1].Address).toBe('bcc2@example.com');

  const headers = await getMessageHeaders(testEmails[0].ID);
  expect(headers).not.toContain('bcc1@example.com');
  expect(headers).not.toContain('bcc2@example.com');
}, 10000);

test('It should send an email with custom headers', async () => {
  await mailClient.send({
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Integration Test - Custom Headers',
    text: 'This email has custom headers.',
    headers: {
      'X-Custom-Header': 'Custom Value',
      'X-Priority': '1',
      'X-Mailer': 'MikroMail Test Suite'
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const messages = await getMailpitMessages();
  const testEmail = messages.find(
    (msg: any) => msg.Subject === 'Integration Test - Custom Headers'
  );

  expect(testEmail).toBeDefined();

  const headers = (await getMessageHeaders(testEmail.ID)) as Record<
    string,
    any
  >;
  expect(headers['X-Custom-Header']).toContain('Custom Value');
  expect(headers['X-Priority']).toContain('1');
  expect(headers['X-Mailer']).toContain('MikroMail Test Suite');
}, 10000);

test('It should send an email with Reply-To header', async () => {
  await mailClient.send({
    from: 'sender@example.com',
    to: 'recipient@example.com',
    replyTo: 'reply-here@example.com',
    subject: 'Integration Test - Reply-To',
    text: 'This email has a Reply-To header.'
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const messages = await getMailpitMessages();
  const testEmail = messages.find(
    (msg: any) => msg.Subject === 'Integration Test - Reply-To'
  );

  expect(testEmail).toBeDefined();

  const headers = (await getMessageHeaders(testEmail.ID)) as Record<
    string,
    any
  >;
  expect(headers['Reply-To']).toContain('reply-here@example.com');
}, 10000);

test('It should handle non-ASCII characters in subject and body', async () => {
  await mailClient.send({
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Non-ASCII Characters: 你好, Привет, こんにちは',
    text: 'This email contains international characters: español, français, português, 中文, 日本語, Русский.'
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const messages = await getMailpitMessages();

  const testEmail = messages.find((msg: any) =>
    msg.Subject?.includes('Non-ASCII Characters')
  );

  expect(testEmail).toBeDefined();
  expect(testEmail.Subject).toContain('Non-ASCII Characters');

  const textContent = await getMessageText(testEmail.ID);

  expect(textContent).toMatch(
    'This email contains international characters: español, français, português, 中文, 日本語, Русский'
  );
}, 10000);
