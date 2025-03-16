import { describe, expect, test } from 'vitest';

import {
  verifyEmailDomain,
  verifyMXRecords
} from '../../../src/utils/index.js';

// These tests will use real DNS lookups
// Note: Tests may fail depending on network connectivity and DNS server availability

describe('verifyMXRecords', () => {
  // Use a timeout for tests that make real network calls
  const TEST_TIMEOUT = 10000; // 10 seconds

  test(
    'It should return true for domains with valid MX records',
    async () => {
      // Test with known domains that should have MX records
      const result = await verifyMXRecords('gmail.com');
      expect(result).toBe(true);
    },
    TEST_TIMEOUT
  );

  test(
    'It should return false for domains without MX records',
    async () => {
      // Test with domains that shouldn't have MX records
      // Using a random subdomain that likely doesn't exist
      const randomString = Math.random().toString(36).substring(7);
      const result = await verifyMXRecords(`${randomString}.example.com`);
      expect(result).toBe(false);
    },
    TEST_TIMEOUT
  );

  test(
    'It should return false for non-existent domains',
    async () => {
      // Generate a random domain name that almost certainly doesn't exist
      const randomDomain = `nonexistent-${Date.now()}.test`;
      const result = await verifyMXRecords(randomDomain);
      expect(result).toBe(false);
    },
    TEST_TIMEOUT
  );
});

describe('verifyEmailDomain', () => {
  const TEST_TIMEOUT = 10000; // 10 seconds

  test(
    'It should return true for emails with valid MX records',
    async () => {
      const result = await verifyEmailDomain('test@gmail.com');
      expect(result).toBe(true);
    },
    TEST_TIMEOUT
  );

  test(
    'It should return false for emails with invalid MX records',
    async () => {
      // Using a random subdomain that likely doesn't exist
      const randomString = Math.random().toString(36).substring(7);
      const result = await verifyEmailDomain(
        `test@${randomString}.example.com`
      );
      expect(result).toBe(false);
    },
    TEST_TIMEOUT
  );

  test('It should return false for email without domain part', async () => {
    const result = await verifyEmailDomain('invalid-email');
    expect(result).toBe(false);
  });

  test('It should return false for email with empty domain part', async () => {
    const result = await verifyEmailDomain('invalid@');
    expect(result).toBe(false);
  });

  test('It should handle empty email string', async () => {
    const result = await verifyEmailDomain('');
    expect(result).toBe(false);
  });

  test(
    'It should correctly extract domain from complex email address',
    async () => {
      const result = await verifyEmailDomain('user.name+tag@gmail.com');
      expect(result).toBe(true);
    },
    TEST_TIMEOUT
  );

  // Add a test for a well-known domain that should have MX records
  test(
    'It should verify Microsoft domain correctly',
    async () => {
      const result = await verifyEmailDomain('test@outlook.com');
      expect(result).toBe(true);
    },
    TEST_TIMEOUT
  );

  // Add a test for a well-known domain that should have MX records
  test(
    'It should verify Yahoo domain correctly',
    async () => {
      const result = await verifyEmailDomain('test@yahoo.com');
      expect(result).toBe(true);
    },
    TEST_TIMEOUT
  );

  // Test for internationalized domain names (IDNs)
  test(
    'It should handle internationalized domain names',
    async () => {
      const result = await verifyEmailDomain('test@xn--80akhbyknj4f.xn--p1ai'); // example.рф in punycode
      expect(typeof result).toBe('boolean');
    },
    TEST_TIMEOUT
  );
});
