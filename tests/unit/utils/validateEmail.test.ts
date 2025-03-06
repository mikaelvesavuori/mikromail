import { expect, test } from 'vitest';

import { validateEmail } from '../../../src/utils';

const invalidEmails = [
  // Missing @ symbol
  'invalidemail.com',
  'user.example.com',
  'userexample.com',

  // Missing domain
  'user@',
  'user@.',

  // Missing username
  '@example.com',

  // Invalid characters
  'user name@example.com',
  'user<>@example.com',
  'user()@example.com',
  'user[]@example.com',
  'user\\@example.com',
  'user"@example.com',

  // Multiple @ symbols
  'user@domain@example.com',

  // Invalid TLD format
  'user@domain.c',
  'user@domain.',

  // IP addresses without brackets
  'user@127.0.0.1',

  // Excessively long parts
  `${'a'.repeat(65)}@example.com`, // Local part > 64 chars
  `user@${'a'.repeat(65)}.com`, // Domain part too long

  // Invalid dot placement
  '.user@example.com',
  'user.@example.com',
  'user@.example.com',
  'user@example..com',

  // Empty parts between dots
  'user@example..com',
  'user..name@example.com',

  // Unicode/emoji in incorrect positions (might be valid in some contexts but commonly rejected)
  'user@😊.com',
  '😊@example.com'
];

const validEmails = [
  'simple@example.com',
  'very.common@example.com',
  'disposable.style.email.with+symbol@example.com',
  'other.email-with-hyphen@example.com',
  'fully-qualified-domain@example.com',
  'user.name+tag+sorting@example.com',
  'x@example.com',
  'example-indeed@strange-example.com',
  'example@s.example',
  'mailhost!username@example.org',
  'user%example.com@example.org',
  'user@[192.168.2.1]',
  'user@[IPv6:2001:db8:1ff::a0b:dbd0]'
];

test('It should reject invalid email addresses', () => {
  for (const email of invalidEmails) expect(validateEmail(email)).toBe(false);
});

test('It should accept valid email addresses', () => {
  for (const email of validEmails) expect(validateEmail(email)).toBe(true);
});
