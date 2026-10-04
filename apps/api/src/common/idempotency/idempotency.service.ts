import { Inject, Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import {
  IdempotencyStatus,
  IIdempotencyService,
  IIdempotencyStore,
  IDEMPOTENCY_STORE,
} from "./idempotency.interface";
import {
  EntityConflictException,
  ValidationDomainException,
} from "../exceptions/domain.exception";

@Injectable()
export class IdempotencyService implements IIdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @Inject(IDEMPOTENCY_STORE)
    private readonly store: IIdempotencyStore
  ) {}

  public async execute<T>(
    key: string,
    payload: unknown,
    ttlSeconds: number,
    operation: () => Promise<T>,
    lockTtlSeconds = 60
  ): Promise<T> {
    const payloadHash = this.computePayloadHash(payload);

    // 1. Check if record already exists
    const existing = await this.store.get<T>(key);
    if (existing) {
      if (existing.status === IdempotencyStatus.PENDING) {
        this.logger.warn(
          `Concurrent request detected for idempotency key '${key}'.`
        );
        throw new EntityConflictException(
          "A request with this idempotency key is currently in progress. Please retry shortly."
        );
      }

      if (existing.status === IdempotencyStatus.COMPLETED) {
        // Payload mismatch guard
        if (existing.payloadHash && existing.payloadHash !== payloadHash) {
          this.logger.error(
            `Payload mismatch for idempotency key '${key}'. Previous: ${existing.payloadHash}, Current: ${payloadHash}`
          );
          throw new ValidationDomainException(
            "Idempotency key payload mismatch. The provided idempotency key was previously used with different request parameters."
          );
        }

        this.logger.log(
          `Idempotency cache hit for key '${key}'. Returning cached response.`
        );
        return existing.response as T;
      }
    }

    // 2. Acquire atomic pending lock
    const acquired = await this.store.setPending(
      key,
      payloadHash,
      lockTtlSeconds
    );

    if (!acquired) {
      this.logger.warn(
        `Failed to acquire lock for idempotency key '${key}' due to concurrent insertion.`
      );
      throw new EntityConflictException(
        "A request with this idempotency key is currently in progress. Please retry shortly."
      );
    }

    // 3. Execute underlying operation
    try {
      const result = await operation();
      await this.store.setCompleted(key, payloadHash, result, ttlSeconds);
      return result;
    } catch (error: unknown) {
      // Release lock on failure so subsequent retries are not blocked
      await this.store.delete(key);
      throw error;
    }
  }

  public computePayloadHash(payload: unknown): string {
    if (payload === undefined || payload === null) {
      return "";
    }
    const normalized =
      typeof payload === "string"
        ? payload
        : JSON.stringify(this.sortObjectKeys(payload));
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }

  private sortObjectKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObjectKeys(item));
    }
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = this.sortObjectKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
}
