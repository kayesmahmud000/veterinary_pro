export interface WatermarkOptions {
  readonly buyerName: string;
  readonly buyerEmail: string;
  readonly orderId: string;
  readonly purchaseDate: string;
  readonly customNotice?: string;
}

export interface WatermarkResult {
  readonly pdfBuffer: Buffer;
  readonly pageCount: number;
  readonly executionTimeMs: number;
}

export interface IPdfWatermarkService {
  /**
   * Applies dynamic anti-piracy watermark overlays onto a PDF buffer.
   */
  applyWatermark(
    pdfBuffer: Buffer,
    options: WatermarkOptions
  ): Promise<WatermarkResult>;

  /**
   * Inspects a PDF buffer and returns the total page count.
   */
  getPageCount(pdfBuffer: Buffer): Promise<number>;
}

export const PDF_WATERMARK_SERVICE = "PDF_WATERMARK_SERVICE";
