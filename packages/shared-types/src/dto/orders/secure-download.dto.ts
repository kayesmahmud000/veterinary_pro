export interface SecureDownloadResponseDto {
  readonly orderId: string;
  readonly itemId: string;
  readonly productId: string;
  readonly productTitle: string;
  readonly productType: string;
  readonly downloadUrl: string;
  readonly expiresInSeconds: number;
  readonly downloadCount: number;
  readonly maxDownloads: number;
  readonly remainingDownloads: number;
  readonly lastDownloadedAt: string;
}
