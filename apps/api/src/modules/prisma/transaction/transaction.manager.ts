import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  ITransactionManager,
  TransactionOptions,
} from "../interfaces/transaction.interface";

@Injectable()
export class TransactionManager implements ITransactionManager {
  private readonly logger = new Logger(TransactionManager.name);

  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const opts = {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
      isolationLevel: options?.isolationLevel,
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        return await fn(tx);
      }, opts);
    } catch (error) {
      // Prisma errors can include supplied password hashes and encrypted payloads.
      // Callers still receive the original exception; operational logs stay safe.
      this.logger.warn("Transaction rollback occurred.");
      throw error;
    }
  }
}
