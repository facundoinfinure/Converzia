import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { logger } from "@/lib/utils/logger";

// ============================================
// PII Encryption Module
// Uses AES-256-GCM for authenticated encryption
// ============================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCODING = "hex";

/**
 * Get the encryption key from environment
 * Must be a 32-byte (64 hex character) key
 */
function getEncryptionKey(): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      "PII_ENCRYPTION_KEY is not configured. " +
      "Generate one with: openssl rand -hex 32"
    );
  }
  
  if (key.length !== 64) {
    throw new Error(
      "PII_ENCRYPTION_KEY must be 64 hex characters (32 bytes). " +
      "Generate one with: openssl rand -hex 32"
    );
  }
  
  return Buffer.from(key, "hex");
}

/**
 * Check if PII encryption is available
 */
export function isPIIEncryptionEnabled(): boolean {
  return !!process.env.PII_ENCRYPTION_KEY && 
         process.env.PII_ENCRYPTION_KEY.length === 64;
}

/**
 * Encrypt sensitive PII data using AES-256-GCM
 * 
 * Output format: iv:authTag:encryptedData (all hex encoded)
 * 
 * @example
 * const encrypted = encryptPII("12345678"); // DNI
 * // Returns: "a1b2c3...:d4e5f6...:789abc..."
 */
export function encryptPII(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }
  
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return [
    iv.toString(ENCODING),
    authTag.toString(ENCODING),
    encrypted.toString(ENCODING),
  ].join(":");
}

/**
 * Decrypt PII data encrypted with encryptPII
 * 
 * @example
 * const decrypted = decryptPII("a1b2c3...:d4e5f6...:789abc...");
 * // Returns: "12345678"
 */
export function decryptPII(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(":")) {
    // Not encrypted or invalid format, return as-is
    return encryptedData;
  }
  
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    logger.warn("Invalid encrypted PII format", undefined, { encryptedLength: encryptedData.length });
    return encryptedData;
  }
  
  const [ivHex, authTagHex, encryptedHex] = parts;
  
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, ENCODING);
    const authTag = Buffer.from(authTagHex, ENCODING);
    const encrypted = Buffer.from(encryptedHex, ENCODING);
    
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString("utf8");
  } catch (error) {
    logger.error("Failed to decrypt PII", error, {});
    // Return the original encrypted data if decryption fails
    // This prevents data loss if key changed
    return encryptedData;
  }
}

/**
 * Check if a value appears to be encrypted
 * (has the iv:authTag:data format)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 3 && 
         parts[0].length === IV_LENGTH * 2 && // IV in hex
         parts[1].length === AUTH_TAG_LENGTH * 2; // Auth tag in hex
}

/**
 * Encrypt PII if not already encrypted
 * Safe to call multiple times on the same value
 */
export function ensureEncrypted(value: string): string {
  if (!value || isEncrypted(value)) {
    return value;
  }
  return encryptPII(value);
}

/**
 * Decrypt PII only if it appears to be encrypted
 * Safe to call on plaintext values
 */
export function ensureDecrypted(value: string): string {
  if (!value || !isEncrypted(value)) {
    return value;
  }
  return decryptPII(value);
}

/**
 * Encrypt an object's sensitive fields
 * 
 * @example
 * const encrypted = encryptSensitiveFields(data, ["dni", "ssn"]);
 */
export function encryptSensitiveFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: string[]
): T {
  const result = { ...data };
  
  for (const field of sensitiveFields) {
    if (result[field] && typeof result[field] === "string") {
      (result as any)[field] = ensureEncrypted(result[field]);
    }
  }
  
  return result;
}

/**
 * Decrypt an object's sensitive fields
 */
export function decryptSensitiveFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: string[]
): T {
  const result = { ...data };
  
  for (const field of sensitiveFields) {
    if (result[field] && typeof result[field] === "string") {
      (result as any)[field] = ensureDecrypted(result[field]);
    }
  }
  
  return result;
}

/**
 * Hash a value for comparison without revealing the original
 * Uses a deterministic approach (same input = same output)
 * NOT for passwords - use bcrypt for that
 */
export function hashForComparison(value: string): string {
  const crypto = require("crypto");
  const key = getEncryptionKey();
  
  return crypto
    .createHmac("sha256", key)
    .update(value)
    .digest("hex");
}

