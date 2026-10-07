/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Returns the encryption key.
 * Expected to be a 32-byte hex string or fallback to a hardcoded development key.
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.DEVICE_CREDENTIAL_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'DEVICE_CREDENTIAL_KEY is missing or invalid. It must be a 64-character hex string (32 bytes).',
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts a plaintext string into a ciphertext format: iv:auth_tag:encrypted_data
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) return plaintext;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a ciphertext format (iv:auth_tag:encrypted_data) back to plaintext.
 */
export function decryptCredential(ciphertext: string): string {
  if (!ciphertext) return ciphertext;

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid credential format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid credential format');
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
