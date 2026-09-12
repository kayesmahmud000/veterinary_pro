import { Injectable, Logger } from "@nestjs/common";
import * as QRCode from "qrcode";
import {
  IQrCodeService,
  QrCodeOptions,
} from "./qr-code.service.interface";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

@Injectable()
export class QrCodeService implements IQrCodeService {
  private readonly logger = new Logger(QrCodeService.name);

  public async generateQrCodePngBuffer(
    payload: string,
    options?: QrCodeOptions
  ): Promise<Buffer> {
    if (!payload || typeof payload !== "string" || !payload.trim()) {
      throw new ValidationDomainException(
        "Cannot generate QR code: Payload string is empty or undefined."
      );
    }

    try {
      const buffer = await QRCode.toBuffer(payload.trim(), {
        type: "png",
        width: options?.width ?? 150,
        margin: options?.margin ?? 1,
        errorCorrectionLevel: options?.errorCorrectionLevel ?? "M",
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      return buffer;
    } catch (error) {
      this.logger.error(
        `Failed to generate QR code PNG buffer: ${(error as Error).message}`,
        (error as Error).stack
      );
      throw new ValidationDomainException(
        `QR code generation error: ${(error as Error).message}`
      );
    }
  }
}
