import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { encryptCredential, decryptCredential } from './encryption';

describe('Encryption Utilities (P3-CRYPTO-*)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Set a valid 32-byte key (64 hex characters) for tests
    process.env.DEVICE_CREDENTIAL_KEY = crypto.randomBytes(32).toString('hex');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('P3-CRYPTO-001: plaintext credential can be encrypted', () => {
    const plaintext = 'SecretAdmin123!';
    const ciphertext = encryptCredential(plaintext);

    expect(ciphertext).toBeDefined();
    expect(ciphertext).not.toContain(plaintext);
    expect(ciphertext.split(':').length).toBe(3); // iv:authTag:encrypted
  });

  it('P3-CRYPTO-002: encrypted credential can be decrypted', () => {
    const plaintext = 'MySuperSecretPassword';
    const ciphertext = encryptCredential(plaintext);
    const decrypted = decryptCredential(ciphertext);

    expect(decrypted).toBe(plaintext);
  });

  it('P3-CRYPTO-003: wrong key cannot decrypt', () => {
    const plaintext = 'AnotherPassword456';
    const ciphertext = encryptCredential(plaintext);

    // Change the key
    process.env.DEVICE_CREDENTIAL_KEY = crypto.randomBytes(32).toString('hex');

    expect(() => decryptCredential(ciphertext)).toThrow();
  });

  it('P3-CRYPTO-004: tampered ciphertext fails authentication', () => {
    const plaintext = 'SensitiveData789';
    const ciphertext = encryptCredential(plaintext);

    // Tamper with the encrypted portion
    const parts = ciphertext.split(':');
    // Change last char of the encrypted data
    parts[2] = parts[2]!.substring(0, parts[2]!.length - 1) + (parts[2]!.endsWith('0') ? '1' : '0');
    const tampered = parts.join(':');

    // AES-GCM should fail authentication
    expect(() => decryptCredential(tampered)).toThrow();
  });

  it('should fail securely if DEVICE_CREDENTIAL_KEY is missing or invalid', () => {
    delete process.env.DEVICE_CREDENTIAL_KEY;

    expect(() => encryptCredential('test')).toThrow('DEVICE_CREDENTIAL_KEY is missing or invalid');
    expect(() => decryptCredential('some:valid:format')).toThrow(
      'DEVICE_CREDENTIAL_KEY is missing or invalid',
    );
  });
});
