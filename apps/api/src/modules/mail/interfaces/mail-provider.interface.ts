export interface EmailMessage {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

export interface IEmailProvider {
  readonly providerName: string;
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
}

export const EMAIL_PROVIDER_TOKEN = "EMAIL_PROVIDER_TOKEN";
