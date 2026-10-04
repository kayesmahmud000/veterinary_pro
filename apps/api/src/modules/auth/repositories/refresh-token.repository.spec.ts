import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RefreshTokenRepository } from "./refresh-token.repository";
import { RefreshTokenEntity } from "../entities/refresh-token.entity";
import {
  EntityConflictException,
  EntityNotFoundException,
} from "../../../common/exceptions/domain.exception";

describe("RefreshTokenRepository", () => {
  let repository: RefreshTokenRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockDbToken = {
    id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
    userId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    tokenHash: "hash-token-value-12345",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    ipAddress: "127.0.0.1",
    userAgent: "Chrome/120.0",
    createdAt: new Date("2026-09-01T10:00:00Z"),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repository = module.get<RefreshTokenRepository>(RefreshTokenRepository);
    prisma = module.get(PrismaService);
  });

  describe("create()", () => {
    it("should persist token and return RefreshTokenEntity", async () => {
      const entity = RefreshTokenEntity.create({
        id: mockDbToken.id,
        userId: mockDbToken.userId,
        tokenHash: mockDbToken.tokenHash,
        expiresAt: mockDbToken.expiresAt,
        ipAddress: mockDbToken.ipAddress,
        userAgent: mockDbToken.userAgent,
      });

      (prisma.refreshToken.create as jest.Mock).mockResolvedValue(mockDbToken);

      const result = await repository.create(entity);

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: mockDbToken.id,
          userId: mockDbToken.userId,
          tokenHash: mockDbToken.tokenHash,
        }),
      });
      expect(result).toBeInstanceOf(RefreshTokenEntity);
      expect(result.id).toBe(mockDbToken.id);
      expect(result.tokenHash).toBe(mockDbToken.tokenHash);
    });

    it("should use transaction client if provided", async () => {
      const entity = RefreshTokenEntity.create({
        userId: mockDbToken.userId,
        tokenHash: mockDbToken.tokenHash,
        expiresAt: mockDbToken.expiresAt,
      });

      const mockTx = {
        refreshToken: {
          create: jest.fn().mockResolvedValue(mockDbToken),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await repository.create(entity, mockTx);

      expect(mockTx.refreshToken.create).toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(result.id).toBe(mockDbToken.id);
    });

    it("should throw EntityConflictException on P2002 duplicate tokenHash", async () => {
      const entity = RefreshTokenEntity.create({
        userId: mockDbToken.userId,
        tokenHash: mockDbToken.tokenHash,
        expiresAt: mockDbToken.expiresAt,
      });

      const error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "5.19.1",
        }
      );
      (prisma.refreshToken.create as jest.Mock).mockRejectedValue(error);

      await expect(repository.create(entity)).rejects.toThrow(
        EntityConflictException
      );
    });
  });

  describe("findById()", () => {
    it("should return null if not found", async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById("non-existent");
      expect(result).toBeNull();
    });

    it("should return RefreshTokenEntity if found", async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockDbToken);

      const result = await repository.findById(mockDbToken.id);
      expect(result).toBeInstanceOf(RefreshTokenEntity);
      expect(result?.id).toBe(mockDbToken.id);
    });
  });

  describe("findByTokenHash()", () => {
    it("should return RefreshTokenEntity when tokenHash matches", async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockDbToken);

      const result = await repository.findByTokenHash(mockDbToken.tokenHash);
      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: mockDbToken.tokenHash },
      });
      expect(result).toBeInstanceOf(RefreshTokenEntity);
      expect(result?.tokenHash).toBe(mockDbToken.tokenHash);
    });

    it("should return null when tokenHash is not found", async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByTokenHash("unknown-hash");
      expect(result).toBeNull();
    });
  });

  describe("findActiveByUserId()", () => {
    it("should return active tokens for user", async () => {
      (prisma.refreshToken.findMany as jest.Mock).mockResolvedValue([mockDbToken]);

      const results = await repository.findActiveByUserId(mockDbToken.userId);

      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockDbToken.userId,
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe(mockDbToken.id);
    });
  });

  describe("revoke()", () => {
    it("should set revokedAt on token", async () => {
      const revokedAt = new Date();
      (prisma.refreshToken.update as jest.Mock).mockResolvedValue({
        ...mockDbToken,
        revokedAt,
      });

      await repository.revoke(mockDbToken.id, revokedAt);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: mockDbToken.id },
        data: { revokedAt },
      });
    });

    it("should throw EntityNotFoundException on P2025", async () => {
      const error = new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2025",
        clientVersion: "5.19.1",
      });
      (prisma.refreshToken.update as jest.Mock).mockRejectedValue(error);

      await expect(repository.revoke("non-existent")).rejects.toThrow(
        EntityNotFoundException
      );
    });
  });

  describe("revokeByTokenHash()", () => {
    it("should update token with matching hash", async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await repository.revokeByTokenHash(mockDbToken.tokenHash);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          tokenHash: mockDbToken.tokenHash,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe("revokeAllForUser()", () => {
    it("should revoke all active tokens for a user and return count", async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const count = await repository.revokeAllForUser(mockDbToken.userId);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockDbToken.userId,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
      expect(count).toBe(3);
    });
  });

  describe("deleteExpiredTokens()", () => {
    it("should delete tokens expired before date", async () => {
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const beforeDate = new Date("2026-09-01T00:00:00Z");
      const count = await repository.deleteExpiredTokens(beforeDate);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: beforeDate } },
      });
      expect(count).toBe(5);
    });
  });
});
