import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AnimalStatus,
  PaginatedRevenuesDto,
  RevenueResponseDto,
  RevenueSummaryResponseDto,
  TransactionCategory,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  ANIMAL_REPOSITORY,
  IAnimalRepository,
} from "../../animals/repositories/animal.repository.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import {
  RecordRevenueDto,
  RevenueQueryDto,
  RevenueSummaryQueryDto,
  UpdateRevenueDto,
} from "../dto";
import { FarmRevenueEntity } from "../entities/farm-revenue.entity";
import {
  FARM_REVENUE_REPOSITORY,
  IFarmRevenueRepository,
} from "../repositories/farm-revenue.repository.interface";
import { IFarmRevenueService } from "./farm-revenue.service.interface";

@Injectable()
export class FarmRevenueService implements IFarmRevenueService {
  private readonly logger = new Logger(FarmRevenueService.name);

  constructor(
    @Inject(FARM_REVENUE_REPOSITORY)
    private readonly farmRevenueRepository: IFarmRevenueRepository,
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager
  ) {}

  public async recordRevenue(
    farmId: string,
    actorUserId: string,
    dto: RecordRevenueDto,
    traceId?: string
  ): Promise<RevenueResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    let linkedAnimal = null;
    if (dto.animalId) {
      linkedAnimal = await this.animalRepository.findById(dto.animalId, farmId);
      if (!linkedAnimal) {
        throw new EntityNotFoundException("Animal", dto.animalId);
      }

      if (
        [AnimalStatus.DECEASED, AnimalStatus.CULLED].includes(
          linkedAnimal.status
        )
      ) {
        throw new ValidationDomainException(
          `Cannot record revenue for animal '${linkedAnimal.tagNumber}' with status '${linkedAnimal.status}'.`
        );
      }

      if (
        linkedAnimal.status === AnimalStatus.SOLD &&
        dto.category === TransactionCategory.LIVESTOCK_SALES
      ) {
        throw new ValidationDomainException(
          `Animal '${linkedAnimal.tagNumber}' has already been sold.`
        );
      }
    }

    const entity = FarmRevenueEntity.create({
      farmId,
      recordedById: actorUserId,
      animalId: dto.animalId,
      category: dto.category,
      amount: dto.amount,
      currency: dto.currency,
      referenceNote: dto.referenceNote,
      receiptUrl: dto.receiptUrl,
      metadata: dto.metadata,
      txDate: dto.txDate,
    });

    const created = await this.transactionManager.run(async (tx) => {
      // If selling livestock and animalId provided, optionally transition animal to SOLD status automatically
      if (
        dto.category === TransactionCategory.LIVESTOCK_SALES &&
        linkedAnimal &&
        dto.markAnimalAsSold !== false
      ) {
        linkedAnimal.updateDetails({ status: AnimalStatus.SOLD });
        await this.animalRepository.update(linkedAnimal, tx);

        await this.auditLogRepository.record(
          {
            userId: actorUserId,
            action: "UPDATE_ANIMAL_STATUS",
            entityType: "Animal",
            entityId: linkedAnimal.id,
            newValues: { status: AnimalStatus.SOLD, reason: "LIVESTOCK_SALE" },
            traceId: activeTraceId,
          },
          tx
        );
      }

      const saved = await this.farmRevenueRepository.create(entity, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "CREATE_REVENUE",
          entityType: "FarmTransaction",
          entityId: saved.id,
          newValues: saved.toDto() as unknown as Record<string, unknown>,
          traceId: activeTraceId,
        },
        tx
      );

      return saved;
    });

    this.logger.log(
      `[TraceId: ${activeTraceId}] Revenue recorded: ${created.id} (Category: ${created.category}, Amount: ${created.amount} ${created.currency}) by user ${actorUserId}`
    );

    return created.toDto();
  }

  public async updateRevenue(
    farmId: string,
    id: string,
    actorUserId: string,
    dto: UpdateRevenueDto,
    traceId?: string
  ): Promise<RevenueResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const existing = await this.farmRevenueRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("FarmRevenue", id);
    }

    if (dto.animalId !== undefined && dto.animalId !== null) {
      const animal = await this.animalRepository.findById(dto.animalId, farmId);
      if (!animal) {
        throw new EntityNotFoundException("Animal", dto.animalId);
      }

      if (
        [AnimalStatus.DECEASED, AnimalStatus.CULLED].includes(animal.status)
      ) {
        throw new ValidationDomainException(
          `Cannot link revenue to animal '${animal.tagNumber}' with status '${animal.status}'.`
        );
      }
    }

    const oldValues = existing.toDto();

    existing.update({
      category: dto.category,
      amount: dto.amount,
      currency: dto.currency,
      referenceNote: dto.referenceNote,
      animalId: dto.animalId,
      receiptUrl: dto.receiptUrl,
      metadata: dto.metadata,
      txDate: dto.txDate,
      syncVersion: dto.syncVersion,
    });

    const updated = await this.transactionManager.run(async (tx) => {
      const saved = await this.farmRevenueRepository.update(existing, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "UPDATE_REVENUE",
          entityType: "FarmTransaction",
          entityId: saved.id,
          oldValues: oldValues as unknown as Record<string, unknown>,
          newValues: saved.toDto() as unknown as Record<string, unknown>,
          traceId: activeTraceId,
        },
        tx
      );

      return saved;
    });

    this.logger.log(
      `[TraceId: ${activeTraceId}] Revenue updated: ${updated.id} by user ${actorUserId}`
    );

    return updated.toDto();
  }

  public async getRevenueById(
    farmId: string,
    id: string
  ): Promise<RevenueResponseDto> {
    const revenue = await this.farmRevenueRepository.findById(id, farmId);
    if (!revenue) {
      throw new EntityNotFoundException("FarmRevenue", id);
    }
    return revenue.toDto();
  }

  public async getRevenues(
    farmId: string,
    query: RevenueQueryDto
  ): Promise<PaginatedRevenuesDto> {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    if (startDate && isNaN(startDate.getTime())) {
      throw new ValidationDomainException("Invalid startDate format.");
    }
    if (endDate && isNaN(endDate.getTime())) {
      throw new ValidationDomainException("Invalid endDate format.");
    }
    if (startDate && endDate && startDate > endDate) {
      throw new ValidationDomainException("startDate cannot be greater than endDate.");
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const { items, total } = await this.farmRevenueRepository.findMany({
      farmId,
      startDate,
      endDate,
      category: query.category,
      animalId: query.animalId,
      search: query.search,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((i) => i.toDto()),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  public async getRevenueSummary(
    farmId: string,
    query: RevenueSummaryQueryDto
  ): Promise<RevenueSummaryResponseDto> {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate.getTime())) {
      throw new ValidationDomainException("Invalid startDate format.");
    }
    if (isNaN(endDate.getTime())) {
      throw new ValidationDomainException("Invalid endDate format.");
    }
    if (startDate > endDate) {
      throw new ValidationDomainException("startDate cannot be greater than endDate.");
    }

    return this.farmRevenueRepository.getSummary({
      farmId,
      startDate,
      endDate,
      animalId: query.animalId,
    });
  }

  public async deleteRevenue(
    farmId: string,
    id: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const existing = await this.farmRevenueRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("FarmRevenue", id);
    }

    const oldValues = existing.toDto();

    existing.softDelete();

    await this.transactionManager.run(async (tx) => {
      await this.farmRevenueRepository.softDelete(existing, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "DELETE_REVENUE",
          entityType: "FarmTransaction",
          entityId: existing.id,
          oldValues: oldValues as unknown as Record<string, unknown>,
          newValues: {
            deletedAt: existing.deletedAt?.toISOString(),
            syncVersion: existing.syncVersion,
          },
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `[TraceId: ${activeTraceId}] Revenue soft-deleted: ${existing.id} by user ${actorUserId}`
    );
  }
}
