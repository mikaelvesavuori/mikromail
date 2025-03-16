import { SMTPClient } from '../../src/SMTPClient.js';

export const MAILPIT_CONFIG = {
  host: 'localhost',
  port: 1025,
  user: '', // Mailpit doesn't need authentication for testing
  password: '',
  secure: false,
  timeout: 10000,
  // Disable authentication for Mailpit
  skipAuthentication: true
};

export const MAILPIT_API = 'http://localhost:8025/api';

export function createMailpitClient() {
  return new SMTPClient({
    ...MAILPIT_CONFIG,
    debug: true
  });
}

export async function getMailpitMessages() {
  const response = await fetch(`${MAILPIT_API}/v1/messages`);
  if (!response.ok)
    throw new Error(`Failed to get messages: ${response.status}`);

  const data: any = await response.json();
  return data.messages || [];
}

export async function clearMailpitMessages() {
  try {
    const response = await fetch(`${MAILPIT_API}/v1/messages`, {
      method: 'DELETE'
    });

    if (!response.ok)
      console.warn(`Failed to clear messages: ${response.status}`);
  } catch (error) {
    console.warn('Error clearing messages:', error);
  }
}

export async function getMessageHtml(messageId: string) {
  const response = await fetch(`${MAILPIT_API}/v1/message/${messageId}`);
  if (!response.ok)
    throw new Error(`Failed to get HTML content: ${response.status}`);

  const data: any = await response.json();
  return data.HTML;
}

export async function getMessageText(messageId: string) {
  const response = await fetch(`${MAILPIT_API}/v1/message/${messageId}`);
  if (!response.ok)
    throw new Error(`Failed to get text content: ${response.status}`);

  const data: any = await response.json();
  return data.Text;
}

export async function getMessageHeaders(messageId: string) {
  const response = await fetch(
    `${MAILPIT_API}/v1/message/${messageId}/headers`
  );
  if (!response.ok)
    throw new Error(`Failed to get headers: ${response.status}`);

  return await response.json();
}
