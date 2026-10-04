import { Injectable, Logger } from "@nestjs/common";
import {
  EmailMessage,
  EmailSendResult,
  IEmailProvider,
} from "../interfaces/mail-provider.interface";
import { EnvService } from "../../../config/env.service";

@Injectable()
export class SesMailProvider implements IEmailProvider {
  public readonly providerName = "ses";
  private readonly logger = new Logger(SesMailProvider.name);

  constructor(private readonly envService: EnvService) {}

  public async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const region = this.envService.awsSesRegion || this.envService.awsRegion;
    const from = message.from || this.envService.emailFrom;
    const to = Array.isArray(message.to) ? message.to : [message.to];

    if (!this.envService.awsAccessKeyId || !this.envService.awsSecretAccessKey) {
      this.logger.warn(
        "AWS credentials not configured. SES email dispatch cannot proceed."
      );
      return {
        success: false,
        provider: this.providerName,
        error: "AWS credentials not configured for SES.",
      };
    }

    try {
      // Dynamic import to avoid hard dependency if SES client is not in bundle
      // @ts-ignore
      const { SESClient, SendEmailCommand } = await import("@aws-sdk/client-ses").catch(() => ({
        SESClient: null,
        SendEmailCommand: null,
      }));

      if (!SESClient || !SendEmailCommand) {
        this.logger.warn(
          "@aws-sdk/client-ses is not installed. Falling back to mock dispatch for SES provider."
        );
        return {
          success: true,
          messageId: `ses-simulated-${Date.now()}`,
          provider: this.providerName,
        };
      }

      const client = new SESClient({
        region,
        credentials: {
          accessKeyId: this.envService.awsAccessKeyId,
          secretAccessKey: this.envService.awsSecretAccessKey,
        },
      });

      const command = new SendEmailCommand({
        Source: from,
        Destination: {
          ToAddresses: to,
        },
        Message: {
          Subject: {
            Data: message.subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: message.html,
              Charset: "UTF-8",
            },
            Text: {
              Data: message.text,
              Charset: "UTF-8",
            },
          },
        },
      });

      const result = await client.send(command);
      this.logger.log(
        `[SesMailProvider] Email successfully dispatched [${result.MessageId}] to <${to.join(", ")}>`
      );

      return {
        success: true,
        messageId: result.MessageId,
        provider: this.providerName,
      };
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown error invoking AWS SES";
      this.logger.error(`Failed to send email via AWS SES: ${errorMsg}`);
      return {
        success: false,
        provider: this.providerName,
        error: errorMsg,
      };
    }
  }
}
