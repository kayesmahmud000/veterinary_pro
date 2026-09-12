import { Injectable, Logger } from "@nestjs/common";
import {
  EmailMessage,
  EmailSendResult,
  IEmailProvider,
} from "../interfaces/mail-provider.interface";
import { EnvService } from "../../../config/env.service";

@Injectable()
export class ResendMailProvider implements IEmailProvider {
  public readonly providerName = "resend";
  private readonly logger = new Logger(ResendMailProvider.name);

  constructor(private readonly envService: EnvService) {}

  public async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const apiKey = this.envService.resendApiKey;
    const from = message.from || this.envService.emailFrom;
    const to = Array.isArray(message.to) ? message.to : [message.to];

    if (!apiKey) {
      this.logger.warn(
        "RESEND_API_KEY is not configured. Email dispatch cannot proceed via Resend."
      );
      return {
        success: false,
        provider: this.providerName,
        error: "RESEND_API_KEY is not configured.",
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
        }),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        const errorMsg =
          (data["message"] as string) ||
          `Resend API error: HTTP ${response.status}`;
        this.logger.error(`Resend dispatch failed: ${errorMsg}`);
        return {
          success: false,
          provider: this.providerName,
          error: errorMsg,
        };
      }

      const messageId = data["id"] as string;
      this.logger.log(
        `[ResendMailProvider] Email successfully dispatched [${messageId}] to <${to.join(", ")}>`
      );

      return {
        success: true,
        messageId,
        provider: this.providerName,
      };
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown error invoking Resend API";
      this.logger.error(`Failed to send email via Resend: ${errorMsg}`);
      return {
        success: false,
        provider: this.providerName,
        error: errorMsg,
      };
    }
  }
}
