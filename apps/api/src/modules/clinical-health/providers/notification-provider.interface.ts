export interface SmsMessage {
  to: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface SmsDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ISmsNotificationProvider {
  sendSms(message: SmsMessage): Promise<SmsDeliveryResult>;
}

export interface PushNotificationMessage {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IPushNotificationProvider {
  sendPush(message: PushNotificationMessage): Promise<PushDeliveryResult>;
}

export const SMS_NOTIFICATION_PROVIDER = "SMS_NOTIFICATION_PROVIDER";
export const PUSH_NOTIFICATION_PROVIDER = "PUSH_NOTIFICATION_PROVIDER";
