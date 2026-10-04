import { Prisma } from "@prisma/client";

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

export interface ITransactionManager {
  run<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;
}

export const TRANSACTION_MANAGER = "TRANSACTION_MANAGER";
