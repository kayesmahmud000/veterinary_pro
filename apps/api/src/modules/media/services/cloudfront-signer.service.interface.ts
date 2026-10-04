export interface CloudFrontSignedCookies {
  policy: string;
  signature: string;
  keyPairId: string;
}

export interface ICloudFrontSignerService {
  /**
   * Signs a single URL using a CloudFront canned policy.
   * Query params added: Expires, Signature, Key-Pair-Id
   */
  signUrl(url: string, expiresInSeconds?: number): string;

  /**
   * Signs a URL using a CloudFront custom policy, allowing wildcard resource patterns.
   * e.g. resourcePattern = 'https://cdn.example.com/hls/product-123/*'
   * Query params added: Policy, Signature, Key-Pair-Id
   */
  signUrlCustomPolicy(
    resourcePattern: string,
    targetUrl: string,
    expiresInSeconds?: number
  ): string;

  /**
   * Generates signed cookies for wildcard resource access (e.g. HLS segments).
   * Returns CloudFront-Policy, CloudFront-Signature, CloudFront-Key-Pair-Id.
   */
  generateSignedCookies(
    resourcePattern: string,
    expiresInSeconds?: number
  ): CloudFrontSignedCookies;

  /**
   * Resolves the base CDN stream URL (e.g., https://cdn.vetralink.pro)
   */
  getStreamBaseUrl(): string;

  /**
   * Indicates whether CloudFront private key and key pair ID are configured.
   */
  isConfigured(): boolean;
}

export const CLOUDFRONT_SIGNER_SERVICE = Symbol("CLOUDFRONT_SIGNER_SERVICE");
