import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as crypto from "crypto";
import { IPkiCryptoService } from "./pki-crypto.service.interface";

@Injectable()
export class PkiCryptoService implements IPkiCryptoService, OnModuleInit {
  private readonly logger = new Logger(PkiCryptoService.name);
  private privateKeyPem!: string;
  private publicKeyPem!: string;

  public onModuleInit(): void {
    this.initializeKeypair();
  }

  private initializeKeypair(): void {
    const envPriv = process.env.RSA_PRIVATE_KEY;
    const envPub = process.env.RSA_PUBLIC_KEY;

    if (envPriv && envPub && envPriv.trim() !== "" && envPub.trim() !== "") {
      this.privateKeyPem = envPriv.trim();
      this.publicKeyPem = envPub.trim();
      this.logger.log("Initialized PKI digital signature service with configured RSA keypair.");
    } else {
      this.logger.log(
        "RSA_PRIVATE_KEY / RSA_PUBLIC_KEY not set in environment. Generating in-memory RSA-2048 keypair.",
      );
      const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: "spki",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
        },
      });

      this.privateKeyPem = privateKey;
      this.publicKeyPem = publicKey;
    }
  }

  public canonicalize(payload: Record<string, unknown>): string {
    return JSON.stringify(this.sortKeysRecursively(payload));
  }

  public hash(data: string): string {
    return crypto.createHash("sha256").update(data, "utf8").digest("hex");
  }

  public sign(data: string): string {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(data, "utf8");
    signer.end();
    return signer.sign(this.privateKeyPem, "base64");
  }

  public verify(data: string, signature: string, publicKey?: string): boolean {
    try {
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(data, "utf8");
      verifier.end();
      const keyToUse = publicKey ?? this.publicKeyPem;
      return verifier.verify(keyToUse, signature, "base64");
    } catch (error) {
      this.logger.warn(`Signature verification failed with error: ${error}`);
      return false;
    }
  }

  public getPublicKey(): string {
    return this.publicKeyPem;
  }

  private sortKeysRecursively(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortKeysRecursively(item));
    }

    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sortedObj[key] = this.sortKeysRecursively(
        (obj as Record<string, unknown>)[key],
      );
    }
    return sortedObj;
  }
}
