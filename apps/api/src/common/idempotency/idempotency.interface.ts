export enum IdempotencyStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
}

export interface IdempotencyRecord<T = unknown> {
  readonly key: string;
  readonly status: IdempotencyStatus;
  readonly payloadHash: string;
  readonly response?: T;
  readonly createdAt: string;
}

export interface IIdempotencyStore {
  get<T>(key: string): Promise<IdempotencyRecord<T> | null>;
  setPending(
    key: string,
    payloadHash: string,
    ttlSeconds: number
  ): Promise<boolean>;
  setCompleted<T>(
    key: string,
    payloadHash: string,
    response: T,
    ttlSeconds: number
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface IIdempotencyService {
  execute<T>(
    key: string,
    payload: unknown,
    ttlSeconds: number,
    operation: () => Promise<T>,
    lockTtlSeconds?: number
  ): Promise<T>;
}

export const IDEMPOTENCY_SERVICE = "IDEMPOTENCY_SERVICE";
export const IDEMPOTENCY_STORE = "IDEMPOTENCY_STORE";
