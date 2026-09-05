import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { AuditLogRepository } from "./audit-log.repository";
import { PrismaService } from "../../prisma/prisma.service";

describe("AuditLogRepository (audit-log.repository.ts)", () => {
  let repository: AuditLogRepository;
  let prismaService: jest.Mocked<any>;

  const mockAuditRecord = {
    id: "uuid-audit-1234",
    userId: "uuid-user-1",
    action: "CREATE",
    entityType: "ANIMAL",
    entityId: "uuid-animal-99",
    oldValues: null,
    newValues: { tagNumber: "COW-100", name: "Bella" },
    traceId: "uuid-trace-abc",
    ipAddress: "192.168.1.1",
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      auditLog: {
        create: jest.fn().mockResolvedValue(mockAuditRecord),
        findMany: jest.fn().mockResolvedValue([mockAuditRecord]),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogRepository,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    repository = module.get<AuditLogRepository>(AuditLogRepository);
  });

  it("should be defined", () => {
    expect(repository).toBeDefined();
  });

  describe("record", () => {
    it("should write audit record using base PrismaService when no tx is provided", async () => {
      const result = await repository.record({
        userId: "uuid-user-1",
        action: "CREATE",
        entityType: "ANIMAL",
        entityId: "uuid-animal-99",
        newValues: { tagNumber: "COW-100", name: "Bella" },
        traceId: "uuid-trace-abc",
        ipAddress: "192.168.1.1",
      });

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "uuid-user-1",
          action: "CREATE",
          entityType: "ANIMAL",
          entityId: "uuid-animal-99",
          traceId: "uuid-trace-abc",
        }),
      });

      expect(result.id).toBe("uuid-audit-1234");
      expect(result.entityType).toBe("ANIMAL");
    });

    it("should delegate to transaction client (tx) when provided", async () => {
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue({
            ...mockAuditRecord,
            id: "tx-audit-999",
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await repository.record(
        {
          userId: "uuid-user-1",
          action: "UPDATE",
          entityType: "FINANCIAL_LEDGER",
          entityId: "uuid-tx-88",
          traceId: "uuid-trace-abc",
        },
        mockTx
      );

      expect((mockTx as any).auditLog.create).toHaveBeenCalledTimes(1);
      expect(prismaService.auditLog.create).not.toHaveBeenCalled();
      expect(result.id).toBe("tx-audit-999");
    });

    it("should scrub sensitive PII and credential keys from audit snapshots", async () => {
      await repository.record({
        userId: "uuid-user-1",
        action: "UPDATE",
        entityType: "USER",
        entityId: "uuid-user-1",
        newValues: {
          email: "vet@vetralink.pro",
          password_hash: "$2b$12$SuperSecretHashValue",
          apiKey: "sk_live_secret_key_123",
          profile: {
            phone: "+1234567890",
            refreshToken: "jwt.refresh.token.sensitive",
          },
        },
        traceId: "uuid-trace-abc",
      });

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          newValues: {
            email: "vet@vetralink.pro",
            password_hash: "[REDACTED]",
            apiKey: "[REDACTED]",
            profile: {
              phone: "+1234567890",
              refreshToken: "[REDACTED]",
            },
          },
        }),
      });
    });
  });

  describe("findByEntity", () => {
    it("should query records and count by entityType and entityId with pagination", async () => {
      const res = await repository.findByEntity("ANIMAL", "uuid-animal-99", 2, 10);

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityType: "ANIMAL", entityId: "uuid-animal-99" },
        orderBy: { createdAt: "desc" },
        skip: 10,
        take: 10,
      });
      expect(prismaService.auditLog.count).toHaveBeenCalledWith({
        where: { entityType: "ANIMAL", entityId: "uuid-animal-99" },
      });

      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
    });
  });

  describe("findByTraceId", () => {
    it("should query records matching traceId in chronological order", async () => {
      const res = await repository.findByTraceId("uuid-trace-abc");

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { traceId: "uuid-trace-abc" },
        orderBy: { createdAt: "asc" },
      });
      expect(res).toHaveLength(1);
      expect(res[0]?.traceId).toBe("uuid-trace-abc");
    });
  });

  describe("query", () => {
    it("should support filtering by entityType, userId, and traceId", async () => {
      const res = await repository.query({
        entityType: "ANIMAL",
        userId: "uuid-user-1",
        traceId: "uuid-trace-abc",
        page: 1,
        pageSize: 15,
      });

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityType: "ANIMAL",
          userId: "uuid-user-1",
          traceId: "uuid-trace-abc",
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 15,
      });

      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
    });
  });
});
