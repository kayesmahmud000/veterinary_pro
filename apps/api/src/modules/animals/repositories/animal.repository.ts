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
import {
  AncestorRecordRaw,
  IAnimalRepository,
  OffspringRecordRaw,
} from "./animal.repository.interface";
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

  public async findManyByIds(
    ids: string[],
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const client = tx ?? this.prisma;

    const rows = await client.animal.findMany({
      where: {
        id: { in: ids },
        farmId,
        deletedAt: null,
      },
      include: {
        sire: { select: { id: true, tagNumber: true, name: true } },
        dam: { select: { id: true, tagNumber: true, name: true } },
      },
      orderBy: { tagNumber: "asc" },
    });

    return rows.map((row) => this.toEntity(row));
  }

  public async getFarmName(
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<string | null> {
    const client = tx ?? this.prisma;

    const farm = await client.farm.findFirst({
      where: {
        id: farmId,
        deletedAt: null,
      },
      select: { name: true },
    });

    return farm?.name ?? null;
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

  public async findAncestors(
    id: string,
    farmId: string,
    maxGenerations: number,
    tx?: Prisma.TransactionClient
  ): Promise<AncestorRecordRaw[]> {
    const client = tx ?? this.prisma;
    const boundedGenerations = Math.min(5, Math.max(1, maxGenerations));

    const rows = await client.$queryRaw<AncestorRecordRaw[]>`
      WITH RECURSIVE ancestors AS (
        -- Anchor: immediate parents of root animal (generation 1)
        SELECT 
          a.id,
          a.tag_number,
          a.rfid_number,
          a.name,
          a.species::text AS species,
          a.breed,
          a.gender::text AS gender,
          a.date_of_birth,
          a.status::text AS status,
          a.sire_id,
          a.dam_id,
          1 AS generation,
          CASE 
            WHEN a.id = root.sire_id THEN 'SIRE' 
            ELSE 'DAM' 
          END AS branch,
          ARRAY[root.id, a.id] AS path
        FROM animals a
        CROSS JOIN (
          SELECT sire_id, dam_id, id 
          FROM animals 
          WHERE id = ${id}::uuid AND farm_id = ${farmId}::uuid AND deleted_at IS NULL
        ) root
        WHERE (a.id = root.sire_id OR a.id = root.dam_id)
          AND a.farm_id = ${farmId}::uuid
          AND a.deleted_at IS NULL

        UNION ALL

        -- Recursive step: parents of current ancestors
        SELECT 
          p.id,
          p.tag_number,
          p.rfid_number,
          p.name,
          p.species::text AS species,
          p.breed,
          p.gender::text AS gender,
          p.date_of_birth,
          p.status::text AS status,
          p.sire_id,
          p.dam_id,
          anc.generation + 1 AS generation,
          anc.branch,
          anc.path || p.id AS path
        FROM animals p
        INNER JOIN ancestors anc ON (p.id = anc.sire_id OR p.id = anc.dam_id)
        WHERE anc.generation < ${boundedGenerations}
          AND p.farm_id = ${farmId}::uuid
          AND p.deleted_at IS NULL
          AND NOT (p.id = ANY(anc.path))
      )
      SELECT 
        id,
        tag_number,
        rfid_number,
        name,
        species,
        breed,
        gender,
        date_of_birth,
        status,
        sire_id,
        dam_id,
        generation,
        branch
      FROM ancestors
      ORDER BY generation ASC, id ASC;
    `;

    return rows;
  }

  public async findDirectOffspring(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<OffspringRecordRaw[]> {
    const client = tx ?? this.prisma;

    const rows = await client.$queryRaw<OffspringRecordRaw[]>`
      SELECT 
        o.id,
        o.tag_number,
        o.rfid_number,
        o.name,
        o.species::text AS species,
        o.breed,
        o.gender::text AS gender,
        o.date_of_birth,
        o.status::text AS status,
        CASE 
          WHEN o.sire_id = ${id}::uuid THEN o.dam_id 
          ELSE o.sire_id 
        END AS other_parent_id,
        p.tag_number AS other_parent_tag_number,
        p.name AS other_parent_name
      FROM animals o
      LEFT JOIN animals p ON (
        p.id = CASE WHEN o.sire_id = ${id}::uuid THEN o.dam_id ELSE o.sire_id END
        AND p.farm_id = ${farmId}::uuid
      )
      WHERE (o.sire_id = ${id}::uuid OR o.dam_id = ${id}::uuid)
        AND o.farm_id = ${farmId}::uuid
        AND o.deleted_at IS NULL
      ORDER BY o.date_of_birth DESC NULLS LAST, o.created_at DESC;
    `;

    return rows;
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
