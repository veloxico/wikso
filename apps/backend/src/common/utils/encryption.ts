import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// HKDF parameters — fixed strings, treat as constants. Changing either breaks
// decryption of any data already at rest, so don't rotate without a migration.
const HKDF_INFO = Buffer.from('wikso.encryption.aes-256-gcm.v1', 'utf8');
const HKDF_SALT = Buffer.from('wikso.encryption.salt.v1', 'utf8');

function getSourceMaterial(): string {
  const primary = process.env.ENCRYPTION_KEY;
  const fallback = process.env.JWT_SECRET;
  const source = primary || fallback;
  if (!source) {
    throw new Error(
      '[security] No encryption key available. Set ENCRYPTION_KEY env variable (`openssl rand -hex 32`).',
    );
  }
  if (!primary && process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      '[security] ENCRYPTION_KEY is not set — falling back to JWT_SECRET. Set a separate ENCRYPTION_KEY for production so rotating one does not invalidate the other.',
    );
  }
  return source;
}

/**
 * Modern key: HKDF-SHA256 over the source secret. Used for all NEW writes.
 *
 * The previous implementation zero-padded the source string into a 32-byte
 * buffer — that turned a short admin password into an AES key with trailing
 * zero bytes, dramatically reducing effective key entropy. HKDF extracts
 * uniform key material from any source length.
 */
function deriveHkdfKey(source: string): Buffer {
  const ikm = Buffer.from(source, 'utf8');
  const okm = hkdfSync('sha256', ikm, HKDF_SALT, HKDF_INFO, 32);
  return Buffer.from(okm);
}

/**
 * Legacy key: zero-padded buffer, kept ONLY for decrypting data written
 * before the HKDF migration. Never used for encryption. After the next
 * write of any given record, that record is re-encrypted under the HKDF
 * key and the legacy path stops being needed for it.
 */
function deriveLegacyKey(source: string): Buffer {
  const key = Buffer.alloc(32);
  Buffer.from(source, 'utf8').copy(key);
  return key;
}

let cachedHkdf: Buffer | null = null;
let cachedLegacy: Buffer | null = null;
function getHkdfKey(): Buffer {
  if (!cachedHkdf) cachedHkdf = deriveHkdfKey(getSourceMaterial());
  return cachedHkdf;
}
function getLegacyKey(): Buffer {
  if (!cachedLegacy) cachedLegacy = deriveLegacyKey(getSourceMaterial());
  return cachedLegacy;
}

/**
 * Encrypt plaintext using AES-256-GCM with the HKDF-derived key.
 * Returns base64-encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getHkdfKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a string previously encrypted with encrypt().
 * Input format: iv:authTag:ciphertext (all base64)
 *
 * Tries the HKDF key first (post-migration data); on auth-tag failure falls
 * back to the legacy zero-pad key (data written before this commit). This
 * lets the upgrade ship without invalidating existing OAuth tokens, AI keys,
 * Slack workspace tokens, and SMTP configs at rest.
 */
export function decrypt(encryptedStr: string): string {
  if (!encryptedStr) return '';

  const parts = encryptedStr.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = parts[2];

  // Path 1: HKDF (current).
  try {
    const decipher = createDecipheriv(ALGORITHM, getHkdfKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // Auth-tag failed — assume this record was encrypted with the legacy
    // zero-padded key. Fall through.
  }

  // Path 2: Legacy zero-pad (pre-2.8 data).
  const legacyDecipher = createDecipheriv(ALGORITHM, getLegacyKey(), iv);
  legacyDecipher.setAuthTag(authTag);
  let legacy = legacyDecipher.update(ciphertext, 'base64', 'utf8');
  legacy += legacyDecipher.final('utf8');
  return legacy;
}
