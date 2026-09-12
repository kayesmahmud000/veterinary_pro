import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  EmailMessage,
  EmailSendResult,
  IEmailProvider,
} from "../interfaces/mail-provider.interface";

@Injectable()
export class MockMailProvider implements IEmailProvider {
  public readonly providerName = "mock";
  private readonly logger = new Logger(MockMailProvider.name);

  public readonly sentEmails: Array<EmailMessage & { id: string; timestamp: Date }> = [];

  public async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const id = `mock-msg-${randomUUID()}`;
    const recipients = Array.isArray(message.to) ? message.to.join(", ") : message.to;

    this.sentEmails.push({
      ...message,
      id,
      timestamp: new Date(),
    });

    this.logger.log(
      `[MockMailProvider] Dispatched mock email [${id}] to <${recipients}>: "${message.subject}"`
    );

    return {
      success: true,
      messageId: id,
      provider: this.providerName,
    };
  }

  public clear(): void {
    this.sentEmails.length = 0;
  }
}
