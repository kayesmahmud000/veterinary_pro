import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { UserRole, UserStatus } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PiiCryptoService } from "../../../common/crypto/pii-crypto.service";
import { UserRepository } from "./user.repository";
import { UserEntity } from "../entities/user.entity";
import {
  EntityConflictException,
  EntityNotFoundException,
} from "../../../common/exceptions/domain.exception";

describe("UserRepository", () => {
  let repository: UserRepository;
  let prisma: jest.Mocked<PrismaService>;
  let piiCrypto: jest.Mocked<PiiCryptoService>;

  const mockDbUser = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    email: "farmer@example.com",
    phone: "iv:tag:ciphertext",
    phoneHash: "hash-farmer-phone",
    passwordHash: "$2b$12$e8V...hashed",
    name: "Farmer John",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
    avatarUrl: "https://example.com/avatar.jpg",
    isEmailVerified: true,
    lastLoginAt: new Date("2026-09-01T10:00:00Z"),
    createdAt: new Date("2026-08-01T10:00:00Z"),
    updatedAt: new Date("2026-09-01T10:00:00Z"),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const mockPiiCryptoService = {
      encrypt: jest.fn((plain: string) => `encrypted:${plain}`),
      decrypt: jest.fn((cipher: string) => `+12025550100`),
      normalizePhone: jest.fn((phone: string) => phone.replace(/\D/g, "")),
      hashPhone: jest.fn((phone: string) => `hashed:${phone}`),
      maskPhone: jest.fn((phone: string) => `+1 •••• 0100`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PiiCryptoService, useValue: mockPiiCryptoService },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
    prisma = module.get(PrismaService);
    piiCrypto = module.get(PiiCryptoService);
  });

  describe("create()", () => {
    it("should encrypt phone and create user in database", async () => {
      const user = UserEntity.create({
        id: mockDbUser.id,
        email: "farmer@example.com",
        phone: "+12025550100",
        passwordHash: "$2b$12$e8V...hashed",
        name: "Farmer John",
        role: UserRole.FARMER,
      });

      (prisma.user.create as jest.Mock).mockResolvedValue(mockDbUser);

      const result = await repository.create(user);

      expect(piiCrypto.encrypt).toHaveBeenCalledWith("+12025550100");
      expect(piiCrypto.hashPhone).toHaveBeenCalledWith("+12025550100");
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: mockDbUser.id,
          email: "farmer@example.com",
          phone: "encrypted:+12025550100",
          phoneHash: "hashed:+12025550100",
        }),
      });
      expect(result).toBeInstanceOf(UserEntity);
      expect(result.id).toBe(mockDbUser.id);
      expect(result.email).toBe(mockDbUser.email);
    });

    it("should use transaction client if provided", async () => {
      const user = UserEntity.create({
        email: "tx@example.com",
        passwordHash: "hash",
        name: "Tx User",
      });

      const mockTx = {
        user: {
          create: jest.fn().mockResolvedValue({
            ...mockDbUser,
            email: "tx@example.com",
            phone: null,
            phoneHash: null,
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await repository.create(user, mockTx);

      expect(mockTx.user.create).toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.email).toBe("tx@example.com");
    });

    it("should throw EntityConflictException when email unique constraint fails", async () => {
      const user = UserEntity.create({
        email: "duplicate@example.com",
        passwordHash: "hash",
        name: "Duplicate User",
      });

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "5.19.1",
          meta: { target: ["email"] },
        }
      );
      (prisma.user.create as jest.Mock).mockRejectedValue(prismaError);

      await expect(repository.create(user)).rejects.toThrow(
        EntityConflictException
      );
    });

    it("should throw EntityConflictException when phone_hash unique constraint fails", async () => {
      const user = UserEntity.create({
        email: "unique@example.com",
        phone: "+12025550100",
        passwordHash: "hash",
        name: "User",
      });

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "5.19.1",
          meta: { target: ["phone_hash"] },
        }
      );
      (prisma.user.create as jest.Mock).mockRejectedValue(prismaError);

      await expect(repository.create(user)).rejects.toThrow(
        EntityConflictException
      );
    });
  });

  describe("findById()", () => {
    it("should return null if user not found", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById("non-existent");
      expect(result).toBeNull();
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: "non-existent", deletedAt: null },
      });
    });

    it("should query including deleted when includeDeleted is true", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockDbUser,
        deletedAt: new Date(),
      });

      const result = await repository.findById(mockDbUser.id, {
        includeDeleted: true,
      });
      expect(result).not.toBeNull();
      expect(result?.isDeleted()).toBe(true);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: mockDbUser.id },
      });
    });
  });

  describe("findByEmail()", () => {
    it("should normalize email and return domain UserEntity", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockDbUser);

      const result = await repository.findByEmail(" FARMER@Example.Com ");
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: "farmer@example.com", deletedAt: null },
      });
      expect(result).toBeInstanceOf(UserEntity);
      expect(result?.email).toBe("farmer@example.com");
      expect(result?.phone).toBe("+12025550100");
    });
  });

  describe("findByPhoneHash()", () => {
    it("should query by phoneHash and return UserEntity", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockDbUser);

      const result = await repository.findByPhoneHash("hash-farmer-phone");
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { phoneHash: "hash-farmer-phone", deletedAt: null },
      });
      expect(result).not.toBeNull();
      expect(result?.phoneHash).toBe("hash-farmer-phone");
    });
  });

  describe("update()", () => {
    it("should update user and return reconstituted entity", async () => {
      const user = UserEntity.reconstitute({
        ...mockDbUser,
        name: "Updated Name",
      });

      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockDbUser,
        name: "Updated Name",
      });

      const result = await repository.update(user);
      expect(result.name).toBe("Updated Name");
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockDbUser.id },
          data: expect.objectContaining({ name: "Updated Name" }),
        })
      );
    });

    it("should throw EntityNotFoundException on P2025", async () => {
      const user = UserEntity.reconstitute(mockDbUser);
      const error = new Prisma.PrismaClientKnownRequestError(
        "Record not found",
        {
          code: "P2025",
          clientVersion: "5.19.1",
        }
      );
      (prisma.user.update as jest.Mock).mockRejectedValue(error);

      await expect(repository.update(user)).rejects.toThrow(
        EntityNotFoundException
      );
    });
  });

  describe("softDelete()", () => {
    it("should set deletedAt timestamp", async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockDbUser,
        deletedAt: new Date(),
      });

      await repository.softDelete(mockDbUser.id);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockDbUser.id },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      });
    });

    it("should throw EntityNotFoundException on P2025", async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Record not found",
        {
          code: "P2025",
          clientVersion: "5.19.1",
        }
      );
      (prisma.user.update as jest.Mock).mockRejectedValue(error);

      await expect(repository.softDelete("unknown")).rejects.toThrow(
        EntityNotFoundException
      );
    });
  });

  describe("findMany()", () => {
    it("should query paginated results with filters", async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockDbUser]);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      const result = await repository.findMany({
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
        search: "John",
        page: 2,
        pageSize: 10,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          role: UserRole.FARMER,
          status: UserStatus.ACTIVE,
          OR: [
            { email: { contains: "John", mode: "insensitive" } },
            { name: { contains: "John", mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        skip: 10,
        take: 10,
      });
      expect(result.total).toBe(1);
      expect(result.items.length).toBe(1);
    });
  });

  describe("existsByEmail() and existsByPhoneHash()", () => {
    it("should return true when user exists by email", async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(1);
      const exists = await repository.existsByEmail("farmer@example.com");
      expect(exists).toBe(true);
    });

    it("should return false when user does not exist by email", async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(0);
      const exists = await repository.existsByEmail("unknown@example.com");
      expect(exists).toBe(false);
    });

    it("should return true when user exists by phoneHash", async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(1);
      const exists = await repository.existsByPhoneHash("some-hash");
      expect(exists).toBe(true);
    });
  });

  describe("decryption error handling", () => {
    it("should set phone to null if decryption throws an error", async () => {
      piiCrypto.decrypt.mockImplementationOnce(() => {
        throw new Error("Corrupted auth tag");
      });

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockDbUser);

      const result = await repository.findById(mockDbUser.id);
      expect(result).not.toBeNull();
      expect(result?.phone).toBeNull();
    });
  });
});
