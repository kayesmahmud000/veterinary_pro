import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EnvService } from "../../../config/env.service";
import { IDrmKeyService } from "./drm-key.service.interface";

@Injectable()
export class DrmKeyService implements IDrmKeyService {
  private readonly logger = new Logger(DrmKeyService.name);
  private static readonly HKDF_INFO = "vetralink-hls-aes128-key";
  private static readonly KEY_LENGTH = 16; // 128 bits for AES-128

  constructor(private readonly envService: EnvService) {}

  /**
   * Deterministically derives a 16-byte (128-bit) AES key using HKDF-SHA256
   * from the master secret and productId.
   *
   * @param productId UUID of the product
   * @returns 16-byte Buffer
   */
  public deriveKey(productId: string): Buffer {
    const masterSecret = Buffer.from(this.envService.hlsDrmKeySecret, "utf-8");
    const salt = Buffer.from(productId, "utf-8");
    const info = Buffer.from(DrmKeyService.HKDF_INFO, "utf-8");

    const derivedArrayBuffer = crypto.hkdfSync(
      "sha256",
      masterSecret,
      salt,
      info,
      DrmKeyService.KEY_LENGTH
    );

    return Buffer.from(derivedArrayBuffer);
  }

  /**
   * Generates an HLS key info file used by FFmpeg for AES-128 encryption.
   *
   * @param productId UUID of the product
   * @param keyUrl The player-accessible URL to request the decryption key
   * @param outputDir Local scratch directory to write the key and keyinfo files
   * @returns Absolute path to the generated .keyinfo file
   */
  public async generateKeyInfoFile(
    productId: string,
    keyUrl: string,
    outputDir: string
  ): Promise<string> {
    const key = this.deriveKey(productId);
    const keyFilePath = join(outputDir, "video.key");
    const keyInfoFilePath = join(outputDir, "video.keyinfo");

    await writeFile(keyFilePath, key);

    // FFmpeg HLS key info format:
    // Line 1: Key URI (as player will fetch it)
    // Line 2: Path to key file (where ffmpeg reads the binary key)
    const keyInfoContent = `${keyUrl}\n${keyFilePath}\n`;
    await writeFile(keyInfoFilePath, keyInfoContent, "utf-8");

    this.logger.log(
      `Generated HLS AES-128 keyinfo file for product [${productId}] at ${keyInfoFilePath}`
    );

    return keyInfoFilePath;
  }
}
