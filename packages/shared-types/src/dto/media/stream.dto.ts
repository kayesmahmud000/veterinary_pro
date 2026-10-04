export interface StreamPlaybackSessionRequestDto {
  productId: string;
}

export interface CloudFrontSignedCookiesDto {
  "CloudFront-Policy": string;
  "CloudFront-Signature": string;
  "CloudFront-Key-Pair-Id": string;
}

export interface StreamPlaybackSessionResponseDto {
  productId: string;
  streamUrl: string;
  drmKeyUrl: string;
  cookies?: CloudFrontSignedCookiesDto;
  expiresAt: string;
  expiresInSeconds: number;
}
