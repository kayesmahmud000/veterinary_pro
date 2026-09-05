import { HttpStatus } from "@nestjs/common";
import { DomainException } from "../../exceptions/domain.exception";

export class PiiCryptoException extends DomainException {
  readonly statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
  readonly errorCode = "PII_CRYPTO_ERROR";

  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}
