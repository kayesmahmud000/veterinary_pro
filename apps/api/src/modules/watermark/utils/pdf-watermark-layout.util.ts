import { createHmac } from "node:crypto";

export interface PageLayoutGeometry {
  readonly width: number;
  readonly height: number;
  readonly isLandscape: boolean;
  readonly diagonalAngleDegrees: number;
  readonly optimalFontSize: number;
  readonly upperBandOffsetY: number;
  readonly lowerBandOffsetY: number;
}

/**
 * Computes adaptive page geometry for dynamic watermark stamping across Portrait and Landscape orientations.
 */
export function computePageLayoutGeometry(
  width: number,
  height: number,
  customAngleDegrees?: number
): PageLayoutGeometry {
  const isLandscape = width > height;
  const diagonalAngleDegrees =
    typeof customAngleDegrees === "number" ? customAngleDegrees : 45;

  // Scale font size proportionally to page dimensions, bounded between 10pt and 18pt
  const baseDimension = isLandscape ? height : width;
  const optimalFontSize = Math.max(
    10,
    Math.min(18, Math.round(baseDimension / 40))
  );

  // Vertical offsets for tri-band coverage (Center, Upper-Third, Lower-Third)
  const verticalSpan = height * 0.26;
  const upperBandOffsetY = verticalSpan;
  const lowerBandOffsetY = -verticalSpan;

  return {
    width,
    height,
    isLandscape,
    diagonalAngleDegrees,
    optimalFontSize,
    upperBandOffsetY,
    lowerBandOffsetY,
  };
}

/**
 * Generates an immutable 16-character cryptographic HMAC-SHA256 Buyer Proof Fingerprint
 * linking the buyer email, order UUID, and timestamp for non-repudiation.
 */
export function generateBuyerIntegrityHash(
  email: string,
  orderId: string,
  timestamp: string,
  secret: string = "vetralink-watermark-integrity-salt-2026"
): string {
  const normalizedPayload = `${email.trim().toLowerCase()}|${orderId.trim()}|${timestamp.trim()}`;
  return createHmac("sha256", secret)
    .update(normalizedPayload)
    .digest("hex")
    .substring(0, 16)
    .toUpperCase();
}

/**
 * Masks buyer email address to preserve PII privacy while maintaining organizational domain attribution.
 * Example: `john.doe@dairyfarm.org` -> `j***e@dairyfarm.org`
 */
export function maskBuyerEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return "***@***.***";
  }

  const parts = email.trim().split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return sanitizeAsciiText(email);
  }

  const [local, domain] = parts;
  const sanitizedDomain = sanitizeAsciiText(domain);

  if (local.length <= 2) {
    return `${local[0] || "*"}***@${sanitizedDomain}`;
  }

  const firstChar = local[0];
  const lastChar = local[local.length - 1];
  return `${firstChar}***${lastChar}@${sanitizedDomain}`;
}

/**
 * Normalizes and sanitizes text strings to ASCII printable characters [0x20 - 0x7E],
 * decomposing Unicode diacritics to prevent WinAnsi standard font glyph encoding exceptions.
 */
export function sanitizeAsciiText(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Decompose accented characters (e.g. é -> e, ü -> u)
  const normalized = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // Replace remaining non-ASCII printable characters with '?'
  return normalized.replace(/[^\x20-\x7E]/g, "?").trim();
}
