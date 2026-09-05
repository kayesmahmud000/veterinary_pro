import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../config/config.module";
import { PiiCryptoService } from "./pii-crypto.service";

@Module({
  imports: [AppConfigModule],
  providers: [PiiCryptoService],
  exports: [PiiCryptoService],
})
export class CryptoModule {}
