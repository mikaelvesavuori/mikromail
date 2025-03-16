import { promises as dnsPromises } from 'node:dns';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { verifyMXRecords } from '../../../src/utils/index.js';

vi.mock('node:dns', () => ({
  promises: {
    resolveMx: vi.fn()
  }
}));

describe('verifyMXRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('It should return true when MX records exist', async () => {
    const mockRecords = [
      { exchange: 'mail.example.com', priority: 10 },
      { exchange: 'backup-mail.example.com', priority: 20 }
    ];

    vi.mocked(dnsPromises.resolveMx).mockResolvedValueOnce(mockRecords);

    const result = await verifyMXRecords('example.com');

    expect(dnsPromises.resolveMx).toHaveBeenCalledTimes(1);
    expect(dnsPromises.resolveMx).toHaveBeenCalledWith('example.com');
    expect(result).toBe(true);
  });

  test('It should return false when no MX records exist', async () => {
    vi.mocked(dnsPromises.resolveMx).mockResolvedValueOnce([]);

    const result = await verifyMXRecords('no-mx-records.com');

    expect(dnsPromises.resolveMx).toHaveBeenCalledTimes(1);
    expect(dnsPromises.resolveMx).toHaveBeenCalledWith('no-mx-records.com');
    expect(result).toBe(false);
  });

  test('It should return false when resolveMx throws an error', async () => {
    vi.mocked(dnsPromises.resolveMx).mockRejectedValueOnce(
      new Error('DNS query failed')
    );

    const result = await verifyMXRecords('invalid-domain.com');

    expect(dnsPromises.resolveMx).toHaveBeenCalledTimes(1);
    expect(dnsPromises.resolveMx).toHaveBeenCalledWith('invalid-domain.com');
    expect(result).toBe(false);
  });

  test('It should handle non-existent domains correctly', async () => {
    vi.mocked(dnsPromises.resolveMx).mockRejectedValueOnce(
      new Error('ENOTFOUND')
    );

    const result = await verifyMXRecords('non-existent-domain.xyz');

    expect(dnsPromises.resolveMx).toHaveBeenCalledTimes(1);
    expect(dnsPromises.resolveMx).toHaveBeenCalledWith(
      'non-existent-domain.xyz'
    );
    expect(result).toBe(false);
  });

  test('It should handle various error types correctly', async () => {
    vi.mocked(dnsPromises.resolveMx).mockRejectedValueOnce(
      new Error('ETIMEOUT')
    );

    const result = await verifyMXRecords('timeout-domain.com');

    expect(dnsPromises.resolveMx).toHaveBeenCalledTimes(1);
    expect(dnsPromises.resolveMx).toHaveBeenCalledWith('timeout-domain.com');
    expect(result).toBe(false);
  });

  test('It should handle null or undefined records correctly', async () => {
    // Test with null records (although this shouldn't happen in reality, it's good to test)
    vi.mocked(dnsPromises.resolveMx).mockResolvedValueOnce(null as any);

    const result = await verifyMXRecords('null-records.com');

    expect(dnsPromises.resolveMx).toHaveBeenCalledTimes(1);
    expect(dnsPromises.resolveMx).toHaveBeenCalledWith('null-records.com');
    expect(result).toBe(false);
  });

  test('It should handle malformed domain inputs correctly', async () => {
    vi.mocked(dnsPromises.resolveMx).mockRejectedValueOnce(
      new Error('Invalid domain')
    );

    const result = await verifyMXRecords('invalid@domain');

    expect(dnsPromises.resolveMx).toHaveBeenCalledTimes(1);
    expect(dnsPromises.resolveMx).toHaveBeenCalledWith('invalid@domain');
    expect(result).toBe(false);
  });

  test('It should handle empty string domain correctly', async () => {
    vi.mocked(dnsPromises.resolveMx).mockRejectedValueOnce(
      new Error('Invalid domain')
    );

    const result = await verifyMXRecords('');

    expect(dnsPromises.resolveMx).toHaveBeenCalledTimes(1);
    expect(dnsPromises.resolveMx).toHaveBeenCalledWith('');
    expect(result).toBe(false);
  });

  test('It should resolve quickly for valid domains', async () => {
    const mockRecords = [{ exchange: 'mail.example.com', priority: 10 }];
    vi.mocked(dnsPromises.resolveMx).mockResolvedValueOnce(mockRecords);

    const startTime = performance.now();
    await verifyMXRecords('example.com');
    const endTime = performance.now();

    const executionTime = endTime - startTime;
    expect(executionTime).toBeLessThan(500);
  });
});
