import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../config/config.module";
import { PiiCryptoService } from "./pii-crypto.service";
import { PkiCryptoService } from "./pki-crypto.service";
import { PKI_CRYPTO_SERVICE } from "./pki-crypto.service.interface";

@Module({
  imports: [AppConfigModule],
  providers: [
    PiiCryptoService,
    PkiCryptoService,
    {
      provide: PKI_CRYPTO_SERVICE,
      useClass: PkiCryptoService,
    },
  ],
  exports: [PiiCryptoService, PkiCryptoService, PKI_CRYPTO_SERVICE],
})
export class CryptoModule {}

