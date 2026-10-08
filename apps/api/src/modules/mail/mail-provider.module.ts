import { Module } from "@nestjs/common";
import { AppConfigModule, EnvService } from "../../config";
import { EMAIL_PROVIDER_TOKEN } from "./interfaces/mail-provider.interface";
import { MockMailProvider } from "./providers/mock-mail.provider";
import { ResendMailProvider } from "./providers/resend-mail.provider";
import { SesMailProvider } from "./providers/ses-mail.provider";
@Module({
  imports: [AppConfigModule],
  providers: [
    MockMailProvider,
    ResendMailProvider,
    SesMailProvider,
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useFactory: (
        env: EnvService,
        mock: MockMailProvider,
        resend: ResendMailProvider,
        ses: SesMailProvider,
      ) =>
        env.emailProvider === "resend"
          ? resend
          : env.emailProvider === "ses"
            ? ses
            : mock,
      inject: [
        EnvService,
        MockMailProvider,
        ResendMailProvider,
        SesMailProvider,
      ],
    },
  ],
  exports: [
    EMAIL_PROVIDER_TOKEN,
    MockMailProvider,
    ResendMailProvider,
    SesMailProvider,
  ],
})
export class MailProviderModule {}
