import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AnimalGender,
  AnimalQueryFilterDto,
  AnimalResponseDto,
  CheckTagAvailabilityDto,
  PaginatedAnimalsDto,
  RegisterAnimalRequestDto,
  TagAvailabilityResponseDto,
  UpdateAnimalRequestDto,
} from "@vetralink/shared-types";
import {
  ANIMAL_REPOSITORY,
  IAnimalRepository,
} from "../repositories/animal.repository.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import { AnimalEntity } from "../entities/animal.entity";
import {
  EntityConflictException,
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { IAnimalsService } from "./animals.service.interface";

@Injectable()
export class AnimalsService implements IAnimalsService {
  private readonly logger = new Logger(AnimalsService.name);

  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager
  ) {}

  public async registerAnimal(
    farmId: string,
    dto: RegisterAnimalRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto> {
    const normalizedTag = dto.tagNumber.trim().toUpperCase();

    // 1. Tag Uniqueness Invariant within Tenant Herd
    const tagExists = await this.animalRepository.existsActiveTag(
      normalizedTag,
      farmId
    );
    if (tagExists) {
      throw new EntityConflictException(
        `An active animal with tag number '${normalizedTag}' already exists in this farm herd.`,
        "tagNumber"
      );
    }

    // 2. RFID Uniqueness Invariant within Tenant Herd (if provided)
    let normalizedRfid: string | null = null;
    if (dto.rfidNumber && dto.rfidNumber.trim().length > 0) {
      normalizedRfid = dto.rfidNumber.trim().toUpperCase();
      const rfidExists = await this.animalRepository.existsActiveRfid(
        normalizedRfid,
        farmId
      );
      if (rfidExists) {
        throw new EntityConflictException(
          `An active animal with RFID number '${normalizedRfid}' already exists in this farm herd.`,
          "rfidNumber"
        );
      }
    }

    // 3. Pedigree Validation (Sire)
    if (dto.sireId) {
      const sire = await this.animalRepository.findById(dto.sireId, farmId);
      if (!sire) {
        throw new EntityNotFoundException("Sire animal", dto.sireId);
      }
      if (sire.gender !== AnimalGender.MALE) {
        throw new ValidationDomainException(
          `Designated sire with tag '${sire.tagNumber}' must be biologically MALE.`
        );
      }
      if (sire.species !== dto.species) {
        throw new ValidationDomainException(
          `Designated sire species ('${sire.species}') must match offspring species ('${dto.species}').`
        );
      }
    }

    // 4. Pedigree Validation (Dam)
    if (dto.damId) {
      const dam = await this.animalRepository.findById(dto.damId, farmId);
      if (!dam) {
        throw new EntityNotFoundException("Dam animal", dto.damId);
      }
      if (dam.gender !== AnimalGender.FEMALE) {
        throw new ValidationDomainException(
          `Designated dam with tag '${dam.tagNumber}' must be biologically FEMALE.`
        );
      }
      if (dam.species !== dto.species) {
        throw new ValidationDomainException(
          `Designated dam species ('${dam.species}') must match offspring species ('${dto.species}').`
        );
      }
    }

    // 5. Date of Birth Parsing & Reality Check
    let dobDate: Date | null = null;
    if (dto.dateOfBirth) {
      dobDate = new Date(dto.dateOfBirth);
      if (isNaN(dobDate.getTime())) {
        throw new ValidationDomainException(
          "Invalid date format for dateOfBirth. Expected ISO 8601 (YYYY-MM-DD)."
        );
      }
      if (dobDate.getTime() > Date.now()) {
        throw new ValidationDomainException(
          "Animal date of birth cannot be in the future."
        );
      }
    }

    // 6. Instantiate Domain Entity
    const animal = AnimalEntity.create({
      farmId,
      tagNumber: normalizedTag,
      rfidNumber: normalizedRfid,
      name: dto.name,
      species: dto.species,
      breed: dto.breed,
      gender: dto.gender,
      dateOfBirth: dobDate,
      weightKg: dto.weightKg,
      status: dto.status,
      sireId: dto.sireId,
      damId: dto.damId,
      metadata: dto.metadata,
    });

    const activeTraceId = traceId ?? crypto.randomUUID();

    // 7. Persist & Audit in an Atomic Transaction
    let savedAnimal!: AnimalEntity;
    await this.transactionManager.run(async (tx) => {
      savedAnimal = await this.animalRepository.create(animal, tx);
      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "ANIMAL_REGISTERED",
          entityType: "Animal",
          entityId: savedAnimal.id,
          newValues: savedAnimal.toResponse() as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Registered animal '${savedAnimal.tagNumber}' [${savedAnimal.id}] for farm [${farmId}]`
    );

    return savedAnimal.toResponse();
  }

  public async updateAnimal(
    id: string,
    farmId: string,
    dto: UpdateAnimalRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto> {
    const existing = await this.animalRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("Animal", id);
    }

    // 1. Tag Uniqueness Check if Updating Tag Number
    if (dto.tagNumber) {
      const normalizedTag = dto.tagNumber.trim().toUpperCase();
      if (normalizedTag !== existing.tagNumber) {
        const tagExists = await this.animalRepository.existsActiveTag(
          normalizedTag,
          farmId,
          id
        );
        if (tagExists) {
          throw new EntityConflictException(
            `An active animal with tag number '${normalizedTag}' already exists in this farm herd.`,
            "tagNumber"
          );
        }
      }
    }

    // 2. RFID Uniqueness Check if Updating RFID Number
    let normalizedRfid: string | null | undefined = undefined;
    if (dto.rfidNumber !== undefined) {
      if (dto.rfidNumber !== null && dto.rfidNumber.trim().length > 0) {
        normalizedRfid = dto.rfidNumber.trim().toUpperCase();
        if (normalizedRfid !== existing.rfidNumber) {
          const rfidExists = await this.animalRepository.existsActiveRfid(
            normalizedRfid,
            farmId,
            id
          );
          if (rfidExists) {
            throw new EntityConflictException(
              `An active animal with RFID number '${normalizedRfid}' already exists in this farm herd.`,
              "rfidNumber"
            );
          }
        }
      } else {
        normalizedRfid = null;
      }
    }

    const targetSpecies = dto.species ?? existing.species;

    // 3. Pedigree Validation (Sire)
    if (dto.sireId !== undefined) {
      if (dto.sireId !== null) {
        if (dto.sireId === id) {
          throw new ValidationDomainException(
            "An animal cannot be designated as its own sire."
          );
        }
        const sire = await this.animalRepository.findById(dto.sireId, farmId);
        if (!sire) {
          throw new EntityNotFoundException("Sire animal", dto.sireId);
        }
        if (sire.gender !== AnimalGender.MALE) {
          throw new ValidationDomainException(
            `Designated sire with tag '${sire.tagNumber}' must be biologically MALE.`
          );
        }
        if (sire.species !== targetSpecies) {
          throw new ValidationDomainException(
            `Designated sire species ('${sire.species}') must match offspring species ('${targetSpecies}').`
          );
        }
      }
    }

    // 4. Pedigree Validation (Dam)
    if (dto.damId !== undefined) {
      if (dto.damId !== null) {
        if (dto.damId === id) {
          throw new ValidationDomainException(
            "An animal cannot be designated as its own dam."
          );
        }
        const dam = await this.animalRepository.findById(dto.damId, farmId);
        if (!dam) {
          throw new EntityNotFoundException("Dam animal", dto.damId);
        }
        if (dam.gender !== AnimalGender.FEMALE) {
          throw new ValidationDomainException(
            `Designated dam with tag '${dam.tagNumber}' must be biologically FEMALE.`
          );
        }
        if (dam.species !== targetSpecies) {
          throw new ValidationDomainException(
            `Designated dam species ('${dam.species}') must match offspring species ('${targetSpecies}').`
          );
        }
      }
    }

    // 5. Date of Birth Parsing
    let dobDate: Date | null | undefined = undefined;
    if (dto.dateOfBirth !== undefined) {
      if (dto.dateOfBirth === null) {
        dobDate = null;
      } else {
        dobDate = new Date(dto.dateOfBirth);
        if (isNaN(dobDate.getTime())) {
          throw new ValidationDomainException(
            "Invalid date format for dateOfBirth. Expected ISO 8601 (YYYY-MM-DD)."
          );
        }
        if (dobDate.getTime() > Date.now()) {
          throw new ValidationDomainException(
            "Animal date of birth cannot be in the future."
          );
        }
      }
    }

    const oldValues = existing.toResponse();

    existing.updateDetails({
      tagNumber: dto.tagNumber,
      rfidNumber: normalizedRfid,
      name: dto.name,
      species: dto.species,
      breed: dto.breed,
      gender: dto.gender,
      dateOfBirth: dobDate,
      weightKg: dto.weightKg,
      status: dto.status,
      sireId: dto.sireId,
      damId: dto.damId,
      metadata: dto.metadata,
    });

    const activeTraceId = traceId ?? crypto.randomUUID();

    let updatedAnimal!: AnimalEntity;
    await this.transactionManager.run(async (tx) => {
      updatedAnimal = await this.animalRepository.update(existing, tx);
      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "ANIMAL_UPDATED",
          entityType: "Animal",
          entityId: updatedAnimal.id,
          oldValues: oldValues as unknown as Record<string, unknown>,
          newValues: updatedAnimal.toResponse() as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Updated animal '${updatedAnimal.tagNumber}' [${updatedAnimal.id}] for farm [${farmId}]`
    );

    return updatedAnimal.toResponse();
  }

  public async getAnimalById(
    id: string,
    farmId: string
  ): Promise<AnimalResponseDto> {
    const animal = await this.animalRepository.findById(id, farmId);
    if (!animal) {
      throw new EntityNotFoundException("Animal", id);
    }
    return animal.toResponse();
  }

  public async lookupByIdentifier(
    identifier: string,
    farmId: string
  ): Promise<AnimalResponseDto> {
    if (!identifier || identifier.trim().length === 0) {
      throw new ValidationDomainException("Scan identifier cannot be empty.");
    }
    const animal = await this.animalRepository.findByIdentifier(
      identifier,
      farmId
    );
    if (!animal) {
      throw new EntityNotFoundException(
        "Animal with tag/RFID identifier",
        identifier
      );
    }
    return animal.toResponse();
  }

  public async checkTagAvailability(
    farmId: string,
    dto: CheckTagAvailabilityDto
  ): Promise<TagAvailabilityResponseDto> {
    let tagResult = undefined;
    let rfidResult = undefined;

    if (dto.tagNumber && dto.tagNumber.trim().length > 0) {
      const normalizedTag = dto.tagNumber.trim().toUpperCase();
      const existingAnimal = await this.animalRepository.findByTagNumber(
        normalizedTag,
        farmId
      );
      const isConflict =
        Boolean(existingAnimal) &&
        (!dto.excludeAnimalId || existingAnimal!.id !== dto.excludeAnimalId);

      tagResult = {
        value: normalizedTag,
        isAvailable: !isConflict,
        conflictingAnimalId: isConflict && existingAnimal ? existingAnimal.id : undefined,
      };
    }

    if (dto.rfidNumber && dto.rfidNumber.trim().length > 0) {
      const normalizedRfid = dto.rfidNumber.trim().toUpperCase();
      const existingAnimal = await this.animalRepository.findByRfidNumber(
        normalizedRfid,
        farmId
      );
      const isConflict =
        Boolean(existingAnimal) &&
        (!dto.excludeAnimalId || existingAnimal!.id !== dto.excludeAnimalId);

      rfidResult = {
        value: normalizedRfid,
        isAvailable: !isConflict,
        conflictingAnimalId: isConflict && existingAnimal ? existingAnimal.id : undefined,
      };
    }

    return {
      ...(tagResult !== undefined && { tagNumber: tagResult }),
      ...(rfidResult !== undefined && { rfidNumber: rfidResult }),
    };
  }

  public async getAnimals(
    farmId: string,
    query: AnimalQueryFilterDto
  ): Promise<PaginatedAnimalsDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const { items, total } = await this.animalRepository.findMany(farmId, query);

    return {
      items: items.map((animal) => animal.toResponse()),
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public async archiveAnimal(
    id: string,
    farmId: string,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto> {
    const existing = await this.animalRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("Animal", id);
    }

    const activeTraceId = traceId ?? crypto.randomUUID();
    const oldValues = existing.toResponse();

    let archived!: AnimalEntity;
    await this.transactionManager.run(async (tx) => {
      archived = await this.animalRepository.softDelete(
        id,
        farmId,
        new Date(),
        tx
      );
      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "ANIMAL_ARCHIVED",
          entityType: "Animal",
          entityId: archived.id,
          oldValues: oldValues as unknown as Record<string, unknown>,
          newValues: archived.toResponse() as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Archived animal '${archived.tagNumber}' [${archived.id}] for farm [${farmId}]`
    );

    return archived.toResponse();
  }
}
