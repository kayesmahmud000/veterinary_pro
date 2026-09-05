import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { TransactionManager } from "./transaction.manager";
import { PrismaService } from "../prisma.service";

describe("TransactionManager (transaction.manager.ts)", () => {
  let manager: TransactionManager;
  let prismaService: jest.Mocked<Partial<PrismaService>>;

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionManager,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    manager = module.get<TransactionManager>(TransactionManager);
  });

  it("should be defined", () => {
    expect(manager).toBeDefined();
  });

  it("should execute callback inside $transaction and return result on success", async () => {
    const mockTx = {} as Prisma.TransactionClient;
    const expectedResult = { id: "res-1", status: "COMMITTED" };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        return await callback(mockTx);
      }
    );

    const result = await manager.run(async (tx) => {
      expect(tx).toBe(mockTx);
      return expectedResult;
    });

    expect(result).toEqual(expectedResult);
    expect(prismaService.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ maxWait: 5000, timeout: 10000 })
    );
  });

  it("should propagate errors and trigger transaction rollback when callback throws", async () => {
    const mockTx = {} as Prisma.TransactionClient;
    const testError = new Error("Database deadlock / rollback");

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        return await callback(mockTx);
      }
    );

    await expect(
      manager.run(async () => {
        throw testError;
      })
    ).rejects.toThrow("Database deadlock / rollback");
  });

  it("should pass custom timeout and isolation options to prisma.$transaction", async () => {
    (prismaService.$transaction as jest.Mock).mockResolvedValue("done");

    await manager.run(async () => "done", {
      timeout: 15000,
      maxWait: 2000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    expect(prismaService.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        timeout: 15000,
        maxWait: 2000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  });
});
