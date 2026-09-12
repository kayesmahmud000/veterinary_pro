export interface QrCodeOptions {
  readonly width?: number; // default 150px
  readonly margin?: number; // default 1 module
  readonly errorCorrectionLevel?: "L" | "M" | "Q" | "H"; // default 'M'
}

export interface IQrCodeService {
  /**
   * Generates a PNG image Buffer for a given verification URL or payload string.
   */
  generateQrCodePngBuffer(
    payload: string,
    options?: QrCodeOptions
  ): Promise<Buffer>;
}

export const QR_CODE_SERVICE = "QR_CODE_SERVICE";
