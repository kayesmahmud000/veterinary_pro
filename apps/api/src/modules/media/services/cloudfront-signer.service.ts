import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import { EnvService } from "../../../config/env.service";
import {
  CloudFrontSignedCookies,
  ICloudFrontSignerService,
} from "./cloudfront-signer.service.interface";

@Injectable()
export class CloudFrontSignerService implements ICloudFrontSignerService {
  private readonly logger = new Logger(CloudFrontSignerService.name);
  private readonly keyPairId?: string;
  private readonly privateKey?: string;
  private readonly distributionDomain?: string;
  private readonly defaultExpirationSeconds: number;

  constructor(private readonly envService: EnvService) {
    this.keyPairId = this.envService.cloudfrontKeyPairId;
    this.privateKey = this.normalizePrivateKey(
      this.envService.cloudfrontPrivateKey
    );
    this.distributionDomain = this.envService.cloudfrontDistributionDomain;
    this.defaultExpirationSeconds =
      this.envService.cloudfrontUrlExpirationSeconds;

    if (!this.isConfigured()) {
      this.logger.warn(
        "CloudFront signing credentials (CLOUDFRONT_KEY_PAIR_ID / CLOUDFRONT_PRIVATE_KEY) not configured. Using local/dev fallback mode."
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.keyPairId && this.privateKey);
  }

  getStreamBaseUrl(): string {
    if (this.distributionDomain) {
      const domain = this.distributionDomain
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      return `https://${domain}`;
    }
    return `http://localhost:${this.envService.port}/media/stream`;
  }

  signUrl(url: string, expiresInSeconds?: number): string {
    const ttl = expiresInSeconds ?? this.defaultExpirationSeconds;
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;

    if (!this.isConfigured()) {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}Expires=${expiresAt}&Signature=dev_mock_signature&Key-Pair-Id=DEV_MOCK_KEY_ID`;
    }

    const cannedPolicy = JSON.stringify({
      Statement: [
        {
          Resource: url,
          Condition: {
            DateLessThan: {
              "AWS:EpochTime": expiresAt,
            },
          },
        },
      ],
    });

    const signature = this.signString(cannedPolicy);
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}Expires=${expiresAt}&Signature=${signature}&Key-Pair-Id=${this.keyPairId}`;
  }

  signUrlCustomPolicy(
    resourcePattern: string,
    targetUrl: string,
    expiresInSeconds?: number
  ): string {
    const ttl = expiresInSeconds ?? this.defaultExpirationSeconds;
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;

    if (!this.isConfigured()) {
      const separator = targetUrl.includes("?") ? "&" : "?";
      return `${targetUrl}${separator}Policy=dev_mock_policy&Signature=dev_mock_signature&Key-Pair-Id=DEV_MOCK_KEY_ID`;
    }

    const customPolicy = JSON.stringify({
      Statement: [
        {
          Resource: resourcePattern,
          Condition: {
            DateLessThan: {
              "AWS:EpochTime": expiresAt,
            },
          },
        },
      ],
    });

    const encodedPolicy = this.encodeCloudFrontBase64(
      Buffer.from(customPolicy, "utf-8")
    );
    const signature = this.signString(customPolicy);
    const separator = targetUrl.includes("?") ? "&" : "?";
    return `${targetUrl}${separator}Policy=${encodedPolicy}&Signature=${signature}&Key-Pair-Id=${this.keyPairId}`;
  }

  generateSignedCookies(
    resourcePattern: string,
    expiresInSeconds?: number
  ): CloudFrontSignedCookies {
    const ttl = expiresInSeconds ?? this.defaultExpirationSeconds;
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;

    if (!this.isConfigured()) {
      return {
        policy: "dev_mock_policy",
        signature: "dev_mock_signature",
        keyPairId: "DEV_MOCK_KEY_ID",
      };
    }

    const customPolicy = JSON.stringify({
      Statement: [
        {
          Resource: resourcePattern,
          Condition: {
            DateLessThan: {
              "AWS:EpochTime": expiresAt,
            },
          },
        },
      ],
    });

    const encodedPolicy = this.encodeCloudFrontBase64(
      Buffer.from(customPolicy, "utf-8")
    );
    const signature = this.signString(customPolicy);

    return {
      policy: encodedPolicy,
      signature,
      keyPairId: this.keyPairId!,
    };
  }

  private signString(data: string): string {
    const signer = crypto.createSign("RSA-SHA1");
    signer.update(data);
    const rawSignature = signer.sign(this.privateKey!);
    return this.encodeCloudFrontBase64(rawSignature);
  }

  private encodeCloudFrontBase64(buffer: Buffer): string {
    return buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/=/g, "_")
      .replace(/\//g, "~");
  }

  private normalizePrivateKey(rawKey?: string): string | undefined {
    if (!rawKey) return undefined;
    if (
      rawKey.startsWith("LS0tLS") ||
      (!rawKey.includes("-----BEGIN") && rawKey.length > 100)
    ) {
      try {
        const decoded = Buffer.from(rawKey, "base64").toString("utf-8");
        if (decoded.includes("-----BEGIN")) {
          return decoded;
        }
      } catch {
        // Fallback to rawKey
      }
    }
    return rawKey.replace(/\\n/g, "\n");
  }
}
