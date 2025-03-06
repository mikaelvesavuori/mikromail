import { promises as dnsPromises } from 'node:dns';

/**
 * Encode text using quoted-printable encoding
 * Follows RFC 2045 specification for MIME encoding
 */
export function encodeQuotedPrintable(text: string): string {
  // First convert line endings to CRLF
  let result = text.replace(/\r?\n/g, '\r\n');

  // Replace = with =3D first (to avoid double encoding)
  result = result.replace(/=/g, '=3D');

  // Convert the string to UTF-8 bytes
  const utf8Bytes = new TextEncoder().encode(result);

  // Process each byte individually
  let encoded = '';
  let lineLength = 0;

  for (let i = 0; i < utf8Bytes.length; i++) {
    const byte = utf8Bytes[i];
    let chunk = '';

    // Only ASCII printable characters (except =) and space can be represented as is
    if ((byte >= 33 && byte <= 126 && byte !== 61) || byte === 32) {
      chunk = String.fromCharCode(byte);
    } else if (byte === 13 || byte === 10) {
      // Keep CR and LF as is
      chunk = String.fromCharCode(byte);
      if (byte === 10) {
        // LF resets the line length
        lineLength = 0;
      }
    } else {
      // Encode all other bytes as =XX
      const hex = byte.toString(16).toUpperCase();
      chunk = `=${hex.length < 2 ? `0${hex}` : hex}`;
    }

    // Check if adding this chunk would exceed line length limit
    // Only add soft line breaks between characters, not in the middle of a sequence
    if (lineLength + chunk.length > 75 && !(byte === 13 || byte === 10)) {
      encoded += '=\r\n';
      lineLength = 0;
    }

    encoded += chunk;
    lineLength += chunk.length;
  }

  return encoded;
}

/**
 * Validates an email address using stricter rules
 */
export function validateEmail(email: string): boolean {
  try {
    // Split into local part and domain
    const [localPart, domain] = email.split('@');

    // Basic rules for local part
    if (!localPart || localPart.length > 64) return false;

    // Check for invalid dot placement in local part
    if (
      localPart.startsWith('.') ||
      localPart.endsWith('.') ||
      localPart.includes('..')
    )
      return false;

    // Check for invalid characters in local part
    if (!/^[a-zA-Z0-9!#$%&'*+\-/=?^_`{|}~.]+$/.test(localPart)) return false;

    // Check domain
    if (!domain || domain.length > 255) return false;

    // Handle IP address domains
    if (domain.startsWith('[') && domain.endsWith(']')) {
      const ipContent = domain.slice(1, -1);
      if (ipContent.startsWith('IPv6:')) return true; // Accept IPv6 format

      const ipv4Regex = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/;
      return ipv4Regex.test(ipContent);
    }

    // Check for invalid dot placement in domain
    if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..'))
      return false;

    // Check domain parts
    const domainParts = domain.split('.');
    if (
      domainParts.length < 2 ||
      domainParts[domainParts.length - 1].length < 2 // TLD is less than 2 characters
    )
      return false;

    // Check domain parts
    for (const part of domainParts) {
      if (!part || part.length > 63) return false;
      // Domain part can't start or end with hyphen, and can only contain alphanumeric and hyphens
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?$/.test(part)) return false;
    }
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Helper function to verify SMTP server MX records
 */
export async function verifyMXRecords(domain: string): Promise<boolean> {
  try {
    const records = await dnsPromises.resolveMx(domain);
    return !!records && records.length > 0;
  } catch (_error) {
    return false;
  }
}

/**
 * Helper function to verify email domain has proper MX records
 */
export async function verifyEmailDomain(email: string): Promise<boolean> {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    return await verifyMXRecords(domain);
  } catch (_error) {
    return false;
  }
}
