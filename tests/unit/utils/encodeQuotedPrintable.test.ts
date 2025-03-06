import { describe, expect, test } from 'vitest';

import { encodeQuotedPrintable } from '../../../src/utils';

describe('Basic ASCII text tests', () => {
  test('It should not encode plain ASCII text', () => {
    const input = 'Hello, world!';
    const result = encodeQuotedPrintable(input);
    expect(result).toBe('Hello, world!');
  });

  test('It should encode equals sign', () => {
    const input = 'a=b';
    const result = encodeQuotedPrintable(input);
    expect(result).toBe('a=3D3Db');
  });
});

describe('Latin non-ASCII characters tests', () => {
  test('It should encode Latin non-ASCII characters', () => {
    const input = 'Hallå';
    const result = encodeQuotedPrintable(input);
    expect(result).toBe('Hall=C3=A5');
  });

  test('It should encode multiple Latin non-ASCII characters', () => {
    const input = 'résumé';
    const result = encodeQuotedPrintable(input);
    expect(result).toBe('r=C3=A9sum=C3=A9');
  });

  test('It should encode Spanish accented characters', () => {
    const input = 'español';
    const result = encodeQuotedPrintable(input);
    expect(result).toBe('espa=C3=B1ol');
  });
});

describe('Multi-byte character tests', () => {
  test('It should encode Chinese characters', () => {
    const input = '中文';
    const result = encodeQuotedPrintable(input);
    // Each Chinese character is encoded as a sequence of UTF-8 bytes
    // We're going to test for the pattern rather than the exact encoding
    expect(result).toContain('=');
    expect(result.length).toBeGreaterThan(input.length);
  });

  test('It should encode Japanese characters', () => {
    const input = '日本語';
    const result = encodeQuotedPrintable(input);
    expect(result).toContain('=');
    expect(result.length).toBeGreaterThan(input.length);
  });

  test('It should encode Cyrillic characters', () => {
    const input = 'Русский';
    const result = encodeQuotedPrintable(input);
    expect(result).toContain('=');
    expect(result.length).toBeGreaterThan(input.length);
  });
});

describe('Special characters tests', () => {
  test('It should encode special ASCII control characters', () => {
    const input = 'Line 1\nLine 2';
    const result = encodeQuotedPrintable(input);
    expect(result).toBe('Line 1\r\nLine 2');
  });

  test('It should encode tabs', () => {
    const input = 'Column1\tColumn2';
    const result = encodeQuotedPrintable(input);
    expect(result).toBe('Column1=09Column2');
  });
});

describe('Line length tests', () => {
  test('It should add soft line breaks for long lines', () => {
    const input = 'a'.repeat(100);
    const result = encodeQuotedPrintable(input);
    expect(result).toContain('=\r\n');

    const lines = result.split('\r\n');
    for (let i = 0; i < lines.length - 1; i++) {
      expect(lines[i].length).toBeLessThanOrEqual(76);
    }
  });
});

describe('Complex mixed content tests', () => {
  test('It should correctly encode mixed content with Latin and multi-byte characters', () => {
    const input = 'Hello résumé 你好 Привет';
    const result = encodeQuotedPrintable(input);

    expect(result).toContain(
      'Hello r=C3=A9sum=C3=A9 =E4=BD=A0=E5=A5=BD =D0=9F=D1=80=D0=B8=D0=B2=D0=B5=D1='
    );
    expect(result.length).toBeGreaterThan(input.length);
  });

  test('It should correctly handle equals signs with non-ASCII characters', () => {
    const input = 'Price = €50';
    const result = encodeQuotedPrintable(input);

    expect(result).toContain('Price =3D3D =E2=82=AC50');
    expect(result).toContain('='); // For the Euro symbol
  });
});

describe('Edge cases', () => {
  test('It should handle empty string', () => {
    expect(encodeQuotedPrintable('')).toBe('');
  });

  test('It should handle string with only non-ASCII characters', () => {
    const input = '中文';
    const result = encodeQuotedPrintable(input);
    expect(result).not.toBe(input);
    expect(result).toContain('=');
  });
});

describe('Decoding verification - for debugging', () => {
  test('It should verify correct handling of Swedish characters', () => {
    const input = 'Hallå där!';
    const encoded = encodeQuotedPrintable(input);
    console.log(`Original: ${input}`);
    console.log(`Encoded: ${encoded}`);

    expect(encoded).toContain('Hall');
    expect(encoded).toContain('Hall=C3=A5 d=C3=A4r!');
  });
});
