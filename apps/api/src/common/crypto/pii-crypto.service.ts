import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import { EnvService } from "../../config/env.service";
import { PiiCryptoException } from "./exceptions/pii-crypto.exception";

export interface IPiiCryptoService {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
  normalizePhone(rawPhone: string): string;
  hashPhone(rawPhone: string): string;
  maskPhone(rawOrNormalizedPhone: string): string;
}

@Injectable()
export class PiiCryptoService implements IPiiCryptoService {
  private readonly logger = new Logger(PiiCryptoService.name);
  private readonly algorithm = "aes-256-gcm";
  private readonly ivLength = 16;
  private readonly key: Buffer;
  private readonly pepper: string;

  constructor(private readonly envService: EnvService) {
    const rawKey = this.envService.aesPiiEncryptionKey;
    if (!rawKey || rawKey.length !== 64) {
      throw new PiiCryptoException(
        "AES_PII_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)."
      );
    }
    this.key = Buffer.from(rawKey, "hex");

    this.pepper = this.envService.hashPepper;
    if (!this.pepper || this.pepper.length < 16) {
      throw new PiiCryptoException(
        "HASH_PEPPER must be at least 16 characters long."
      );
    }
  }

  /**
   * Encrypts plaintext using AES-256-GCM authenticated encryption.
   * Returns a compact string in the format: `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
   */
  public encrypt(plaintext: string): string {
    if (!plaintext || typeof plaintext !== "string") {
      throw new PiiCryptoException("Plaintext for encryption cannot be empty.");
    }

    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);

      const authTag = cipher.getAuthTag();

      return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
    } catch (error) {
      this.logger.error("AES-256-GCM encryption failed", (error as Error).stack);
      throw new PiiCryptoException("Encryption failed due to an internal error.");
    }
  }

  /**
   * Decrypts an AES-256-GCM ciphertext in `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>` format.
   * Enforces cryptographic integrity check via GCM AuthTag.
   */
  public decrypt(ciphertext: string): string {
    if (!ciphertext || typeof ciphertext !== "string") {
      throw new PiiCryptoException("Ciphertext for decryption cannot be empty.");
    }

    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      throw new PiiCryptoException(
        "Invalid ciphertext format. Expected <iv>:<auth_tag>:<encrypted_payload>."
      );
    }

    const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];

    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new PiiCryptoException("Corrupted ciphertext parts.");
    }

    try {
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const encrypted = Buffer.from(encryptedHex, "hex");

      if (iv.length !== this.ivLength) {
        throw new PiiCryptoException("Invalid IV length in ciphertext.");
      }

      if (authTag.length !== 16) {
        throw new PiiCryptoException("Invalid AuthTag length in ciphertext.");
      }

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString("utf8");
    } catch (error) {
      if (error instanceof PiiCryptoException) {
        throw error;
      }
      this.logger.warn(
        "AES-256-GCM decryption failed: AuthTag verification failed or corrupted ciphertext."
      );
      throw new PiiCryptoException(
        "Decryption failed: Ciphertext has been tampered with or corrupted."
      );
    }
  }

  /**
   * Normalizes a phone number to standard international digit representation:
   * Retains leading '+' if present, strips all whitespace, parentheses, hyphens, and dots.
   * e.g., '+1 (202) 555-0100' -> '+12025550100'
   */
  public normalizePhone(rawPhone: string): string {
    if (!rawPhone || typeof rawPhone !== "string") {
      throw new PiiCryptoException("Phone number to normalize cannot be empty.");
    }

    const trimmed = rawPhone.trim();
    const hasLeadingPlus = trimmed.startsWith("+");
    const digitsOnly = trimmed.replace(/\D/g, "");

    if (digitsOnly.length === 0) {
      throw new PiiCryptoException("Phone number contains no valid digits.");
    }

    return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
  }

  /**
   * Generates a deterministic HMAC-SHA256 blind index hash of a normalized phone number.
   * Enables O(1) indexed database lookups on `users.phone_hash` without exposing plaintext.
   */
  public hashPhone(rawPhone: string): string {
    const normalized = this.normalizePhone(rawPhone);
    return crypto
      .createHmac("sha256", this.pepper)
      .update(normalized, "utf8")
      .digest("hex");
  }

  /**
   * Masks a phone number for non-privileged client display.
   * e.g. '+8801712345678' -> '+880 •••• ••5678'
   */
  public maskPhone(rawOrNormalizedPhone: string): string {
    const normalized = this.normalizePhone(rawOrNormalizedPhone);
    if (normalized.length <= 4) {
      return normalized;
    }

    const prefixLength = normalized.startsWith("+") ? 4 : 2;
    const suffixLength = 4;

    if (normalized.length <= prefixLength + suffixLength) {
      const lastFour = normalized.slice(-4);
      return `•••• ${lastFour}`;
    }

    const prefix = normalized.slice(0, prefixLength);
    const suffix = normalized.slice(-suffixLength);
    const maskedLength = normalized.length - prefixLength - suffixLength;
    const maskedSection = "•".repeat(Math.max(maskedLength, 4));

    return `${prefix} ${maskedSection} ${suffix}`;
  }
}
