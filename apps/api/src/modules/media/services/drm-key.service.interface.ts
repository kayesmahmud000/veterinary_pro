export const DRM_KEY_SERVICE = Symbol("DRM_KEY_SERVICE");

export interface IDrmKeyService {
  /**
   * Deterministically derives a 16-byte (128-bit) AES key using HKDF-SHA256
   * from the master secret and productId.
   *
   * @param productId UUID of the product
   * @returns 16-byte Buffer
   */
  deriveKey(productId: string): Buffer;

  /**
   * Generates an HLS key info file used by FFmpeg for AES-128 encryption.
   *
   * @param productId UUID of the product
   * @param keyUrl The player-accessible URL to request the decryption key
   * @param outputDir Local scratch directory to write the key and keyinfo files
   * @returns Absolute path to the generated .keyinfo file
   */
  generateKeyInfoFile(
    productId: string,
    keyUrl: string,
    outputDir: string
  ): Promise<string>;
}
