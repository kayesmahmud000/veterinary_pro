import { Injectable } from "@nestjs/common";
import {
  IdempotencyRecord,
  IdempotencyStatus,
  IIdempotencyStore,
} from "../idempotency.interface";

interface MemoryEntry<T = unknown> {
  record: IdempotencyRecord<T>;
  expiresAt: number;
}

@Injectable()
export class MemoryIdempotencyStore implements IIdempotencyStore {
  private readonly store = new Map<string, MemoryEntry<unknown>>();

  public async get<T>(key: string): Promise<IdempotencyRecord<T> | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.record as IdempotencyRecord<T>;
  }

  public async setPending(
    key: string,
    payloadHash: string,
    ttlSeconds: number
  ): Promise<boolean> {
    const existing = await this.get(key);
    if (existing) {
      return false;
    }

    const record: IdempotencyRecord = {
      key,
      status: IdempotencyStatus.PENDING,
      payloadHash,
      createdAt: new Date().toISOString(),
    };

    this.store.set(key, {
      record,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    return true;
  }

  public async setCompleted<T>(
    key: string,
    payloadHash: string,
    response: T,
    ttlSeconds: number
  ): Promise<void> {
    const record: IdempotencyRecord<T> = {
      key,
      status: IdempotencyStatus.COMPLETED,
      payloadHash,
      response,
      createdAt: new Date().toISOString(),
    };

    this.store.set(key, {
      record,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }
}
