import { Injectable, Logger } from "@nestjs/common";
import {
  IPushNotificationProvider,
  ISmsNotificationProvider,
  PushDeliveryResult,
  PushNotificationMessage,
  SmsDeliveryResult,
  SmsMessage,
} from "./notification-provider.interface";

@Injectable()
export class MockSmsNotificationProvider implements ISmsNotificationProvider {
  private readonly logger = new Logger(MockSmsNotificationProvider.name);
  public readonly sentMessages: SmsMessage[] = [];
  public shouldFail = false;
  public failureError = "Simulated SMS Gateway Error";

  public async sendSms(message: SmsMessage): Promise<SmsDeliveryResult> {
    if (this.shouldFail) {
      this.logger.warn(`Failed sending mock SMS to ${message.to}: ${this.failureError}`);
      return {
        success: false,
        error: this.failureError,
      };
    }

    this.sentMessages.push(message);
    const messageId = `mock-sms-${crypto.randomUUID()}`;
    this.logger.log(`[MOCK SMS] To: ${message.to} | Message: ${message.body}`);

    return {
      success: true,
      messageId,
    };
  }

  public clear(): void {
    this.sentMessages.length = 0;
    this.shouldFail = false;
  }
}

@Injectable()
export class MockPushNotificationProvider implements IPushNotificationProvider {
  private readonly logger = new Logger(MockPushNotificationProvider.name);
  public readonly sentNotifications: PushNotificationMessage[] = [];
  public shouldFail = false;
  public failureError = "Simulated Push Gateway Error";

  public async sendPush(
    message: PushNotificationMessage
  ): Promise<PushDeliveryResult> {
    if (this.shouldFail) {
      this.logger.warn(
        `Failed sending mock Push to user ${message.userId}: ${this.failureError}`
      );
      return {
        success: false,
        error: this.failureError,
      };
    }

    this.sentNotifications.push(message);
    const messageId = `mock-push-${crypto.randomUUID()}`;
    this.logger.log(
      `[MOCK PUSH] User: ${message.userId} | Title: ${message.title} | Body: ${message.body}`
    );

    return {
      success: true,
      messageId,
    };
  }

  public clear(): void {
    this.sentNotifications.length = 0;
    this.shouldFail = false;
  }
}
