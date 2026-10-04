import { OrderStatus } from "../../enums/index.js";

export interface DownloadTokenItemDto {
  readonly itemId: string;
  readonly productId: string;
  readonly productTitle: string;
  readonly productType?: string;
  readonly downloadToken: string;
  readonly downloadCount: number;
  readonly maxDownloads: number;
  readonly lastDownloadedAt: string | null;
  readonly isDownloadable: boolean;
}

export interface OrderDownloadTokensResponseDto {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly items: DownloadTokenItemDto[];
  readonly generatedAt: string;
}
