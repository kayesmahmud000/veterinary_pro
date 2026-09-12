export interface StreamSessionResult {
  productId: string;
  streamUrl: string;
  drmKeyUrl: string;
  cookies?: {
    policy: string;
    signature: string;
    keyPairId: string;
  };
  expiresAt: Date;
  expiresInSeconds: number;
}

export interface IStreamDeliveryService {
  createPlaybackSession(
    userId: string,
    userRole: string,
    productId: string,
    hostHeader?: string,
    protocol?: string
  ): Promise<StreamSessionResult>;
}

export const STREAM_DELIVERY_SERVICE = Symbol("STREAM_DELIVERY_SERVICE");
