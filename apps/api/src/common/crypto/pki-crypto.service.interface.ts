export const PKI_CRYPTO_SERVICE = Symbol("PKI_CRYPTO_SERVICE");

export interface IPkiCryptoService {
  /**
   * Deterministically serializes an object into canonical JSON with sorted keys.
   */
  canonicalize(payload: Record<string, unknown>): string;

  /**
   * Computes the SHA-256 cryptographic digest of a string (in hex).
   */
  hash(data: string): string;

  /**
   * Computes an RSA-SHA256 digital signature over the provided data.
   * Returns a Base64-encoded signature string.
   */
  sign(data: string): string;

  /**
   * Cryptographically verifies an RSA-SHA256 signature against the provided data.
   * @param data The canonical data string that was signed
   * @param signature The Base64-encoded signature to verify
   * @param publicKey Optional PEM public key (defaults to clinic public key)
   */
  verify(data: string, signature: string, publicKey?: string): boolean;

  /**
   * Retrieves the current clinic/system RSA public key in PEM format.
   */
  getPublicKey(): string;
}
