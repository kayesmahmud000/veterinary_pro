import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  AnimalGender,
  AnimalQueryFilterDto,
  AnimalSpecies,
  AnimalStatus,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { AnimalEntity } from "../entities/animal.entity";
import { IAnimalRepository } from "./animal.repository.interface";
import { EntityConflictException } from "../../../common/exceptions/domain.exception";

type AnimalWithPedigree = Prisma.AnimalGetPayload<{
  include: {
    sire: { select: { id: true; tagNumber: true; name: true } };
    dam: { select: { id: true; tagNumber: true; name: true } };
  };
}>;

@Injectable()
export class AnimalRepository implements IAnimalRepository {
  private readonly logger = new Logger(AnimalRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    animal: AnimalEntity,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity> {
    const client = tx ?? this.prisma;

    try {
      const created = await client.animal.create({
        data: {
          id: animal.id,
          farmId: animal.farmId,
          tagNumber: animal.tagNumber,
          rfidNumber: animal.rfidNumber,
          name: animal.name,
          species: animal.species,
          breed: animal.breed,
          gender: animal.gender,
          dateOfBirth: animal.dateOfBirth,
          weightKg:
            animal.weightKg !== null && animal.weightKg !== undefined
              ? new Prisma.Decimal(animal.weightKg)
              : null,
          status: animal.status,
          sireId: animal.sireId,
          damId: animal.damId,
          metadata: animal.metadata as Prisma.InputJsonValue,
          syncVersion: animal.syncVersion,
          createdAt: animal.createdAt,
          updatedAt: animal.updatedAt,
          deletedAt: animal.deletedAt,
        },
        include: {
          sire: { select: { id: true, tagNumber: true, name: true } },
          dam: { select: { id: true, tagNumber: true, name: true } },
        },
      });

      return this.toEntity(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = (error.meta?.target as string[]) || [];
        const isRfid =
          target.includes("rfid_number") ||
          (error.message && error.message.includes("rfid"));
        if (isRfid) {
          throw new EntityConflictException(
            `An active animal with RFID number '${animal.rfidNumber}' already exists in this farm herd.`,
            "rfidNumber"
          );
        }
        throw new EntityConflictException(
          `An active animal with tag number '${animal.tagNumber}' already exists in this farm herd.`,
          "tagNumber"
        );
      }
      throw error;
    }
  }

  public async update(
    animal: AnimalEntity,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity> {
    const client = tx ?? this.prisma;

    try {
      const updated = await client.animal.update({
        where: {
          id: animal.id,
          farmId: animal.farmId,
        },
        data: {
          tagNumber: animal.tagNumber,
          rfidNumber: animal.rfidNumber,
          name: animal.name,
          species: animal.species,
          breed: animal.breed,
          gender: animal.gender,
          dateOfBirth: animal.dateOfBirth,
          weightKg:
            animal.weightKg !== null && animal.weightKg !== undefined
              ? new Prisma.Decimal(animal.weightKg)
              : null,
          status: animal.status,
          sireId: animal.sireId,
          damId: animal.damId,
          metadata: animal.metadata as Prisma.InputJsonValue,
          syncVersion: animal.syncVersion,
          updatedAt: animal.updatedAt,
          deletedAt: animal.deletedAt,
        },
        include: {
          sire: { select: { id: true, tagNumber: true, name: true } },
          dam: { select: { id: true, tagNumber: true, name: true } },
        },
      });

      return this.toEntity(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = (error.meta?.target as string[]) || [];
        const isRfid =
          target.includes("rfid_number") ||
          (error.message && error.message.includes("rfid"));
        if (isRfid) {
          throw new EntityConflictException(
            `An active animal with RFID number '${animal.rfidNumber}' already exists in this farm herd.`,
            "rfidNumber"
          );
        }
        throw new EntityConflictException(
          `An active animal with tag number '${animal.tagNumber}' already exists in this farm herd.`,
          "tagNumber"
        );
      }
      throw error;
    }
  }

  public async findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity | null> {
    const client = tx ?? this.prisma;

    const row = await client.animal.findFirst({
      where: {
        id,
        farmId,
        deletedAt: null,
      },
      include: {
        sire: { select: { id: true, tagNumber: true, name: true } },
        dam: { select: { id: true, tagNumber: true, name: true } },
      },
    });

    return row ? this.toEntity(row) : null;
  }

  public async findByTagNumber(
    tagNumber: string,
    farmId: string,
    includeSoftDeleted = false,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity | null> {
    const client = tx ?? this.prisma;

    const row = await client.animal.findFirst({
      where: {
        farmId,
        tagNumber: tagNumber.trim().toUpperCase(),
        ...(includeSoftDeleted ? {} : { deletedAt: null }),
      },
      include: {
        sire: { select: { id: true, tagNumber: true, name: true } },
        dam: { select: { id: true, tagNumber: true, name: true } },
      },
    });

    return row ? this.toEntity(row) : null;
  }

  public async findByRfidNumber(
    rfidNumber: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity | null> {
    const client = tx ?? this.prisma;

    const row = await client.animal.findFirst({
      where: {
        farmId,
        rfidNumber: rfidNumber.trim().toUpperCase(),
        deletedAt: null,
      },
      include: {
        sire: { select: { id: true, tagNumber: true, name: true } },
        dam: { select: { id: true, tagNumber: true, name: true } },
      },
    });

    return row ? this.toEntity(row) : null;
  }

  public async findByIdentifier(
    identifier: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity | null> {
    const client = tx ?? this.prisma;
    const normalized = identifier.trim().toUpperCase();

    const row = await client.animal.findFirst({
      where: {
        farmId,
        deletedAt: null,
        OR: [
          { tagNumber: normalized },
          { rfidNumber: normalized },
        ],
      },
      include: {
        sire: { select: { id: true, tagNumber: true, name: true } },
        dam: { select: { id: true, tagNumber: true, name: true } },
      },
    });

    return row ? this.toEntity(row) : null;
  }

  public async findMany(
    farmId: string,
    filter: AnimalQueryFilterDto,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: AnimalEntity[]; total: number }> {
    const client = tx ?? this.prisma;
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AnimalWhereInput = {
      farmId,
      deletedAt: null,
      ...(filter.species ? { species: filter.species } : {}),
      ...(filter.gender ? { gender: filter.gender } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              {
                tagNumber: {
                  contains: filter.search.trim().toUpperCase(),
                  mode: "insensitive",
                },
              },
              {
                rfidNumber: {
                  contains: filter.search.trim().toUpperCase(),
                  mode: "insensitive",
                },
              },
              {
                name: {
                  contains: filter.search.trim(),
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const sortBy = filter.sortBy ?? "createdAt";
    const sortOrder = filter.sortOrder ?? "desc";
    const orderBy: Prisma.AnimalOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [rows, total] = await Promise.all([
      client.animal.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          sire: { select: { id: true, tagNumber: true, name: true } },
          dam: { select: { id: true, tagNumber: true, name: true } },
        },
      }),
      client.animal.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toEntity(row)),
      total,
    };
  }

  public async existsActiveTag(
    tagNumber: string,
    farmId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const client = tx ?? this.prisma;

    const count = await client.animal.count({
      where: {
        farmId,
        tagNumber: tagNumber.trim().toUpperCase(),
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    return count > 0;
  }

  public async existsActiveRfid(
    rfidNumber: string,
    farmId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const client = tx ?? this.prisma;

    const count = await client.animal.count({
      where: {
        farmId,
        rfidNumber: rfidNumber.trim().toUpperCase(),
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    return count > 0;
  }

  public async softDelete(
    id: string,
    farmId: string,
    deletedAt = new Date(),
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity> {
    const client = tx ?? this.prisma;

    const updated = await client.animal.update({
      where: {
        id,
        farmId,
      },
      data: {
        deletedAt,
        updatedAt: deletedAt,
        syncVersion: { increment: 1 },
      },
      include: {
        sire: { select: { id: true, tagNumber: true, name: true } },
        dam: { select: { id: true, tagNumber: true, name: true } },
      },
    });

    return this.toEntity(updated);
  }

  private toEntity(row: AnimalWithPedigree): AnimalEntity {
    return AnimalEntity.reconstitute({
      id: row.id,
      farmId: row.farmId,
      tagNumber: row.tagNumber,
      rfidNumber: row.rfidNumber,
      name: row.name,
      species: row.species as AnimalSpecies,
      breed: row.breed,
      gender: row.gender as AnimalGender,
      dateOfBirth: row.dateOfBirth,
      weightKg: row.weightKg ? row.weightKg.toNumber() : null,
      status: row.status as AnimalStatus,
      sireId: row.sireId,
      damId: row.damId,
      sire: row.sire ? { id: row.sire.id, tagNumber: row.sire.tagNumber, name: row.sire.name } : null,
      dam: row.dam ? { id: row.dam.id, tagNumber: row.dam.tagNumber, name: row.dam.name } : null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      syncVersion: row.syncVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }
}
