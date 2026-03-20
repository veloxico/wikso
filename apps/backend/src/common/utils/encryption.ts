import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw) {
    // Fallback to JWT_SECRET but warn — they should be separate keys
    const fallback = process.env.JWT_SECRET || '';
    if (!fallback) {
      throw new Error('No encryption key available. Set ENCRYPTION_KEY env variable.');
    }
    if (process.env.NODE_ENV === 'production') {
      console.warn('[security] ENCRYPTION_KEY is not set — falling back to JWT_SECRET. Set a separate ENCRYPTION_KEY for production.');
    }
    const key = Buffer.alloc(32);
    Buffer.from(fallback, 'utf8').copy(key);
    return key;
  }
  // Ensure exactly 32 bytes for AES-256
  const key = Buffer.alloc(32);
  Buffer.from(raw, 'utf8').copy(key);
  return key;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
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
 */
export function decrypt(encryptedStr: string): string {
  if (!encryptedStr) return '';

  const key = getEncryptionKey();
  const parts = encryptedStr.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
