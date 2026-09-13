import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AnimalStatus,
  ExpenseResponseDto,
  ExpenseSummaryResponseDto,
  PaginatedExpensesDto,
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
  ExpenseQueryDto,
  ExpenseSummaryQueryDto,
  RecordExpenseDto,
  UpdateExpenseDto,
} from "../dto";
import { FarmExpenseEntity } from "../entities/farm-expense.entity";
import {
  FARM_EXPENSE_REPOSITORY,
  IFarmExpenseRepository,
} from "../repositories/farm-expense.repository.interface";
import { IFarmExpenseService } from "./farm-expense.service.interface";

@Injectable()
export class FarmExpenseService implements IFarmExpenseService {
  private readonly logger = new Logger(FarmExpenseService.name);

  constructor(
    @Inject(FARM_EXPENSE_REPOSITORY)
    private readonly farmExpenseRepository: IFarmExpenseRepository,
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager
  ) {}

  public async recordExpense(
    farmId: string,
    actorUserId: string,
    dto: RecordExpenseDto,
    traceId?: string
  ): Promise<ExpenseResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    // 1. If animalId is supplied, verify animal existence and status
    if (dto.animalId) {
      const animal = await this.animalRepository.findById(dto.animalId, farmId);
      if (!animal) {
        throw new EntityNotFoundException("Animal", dto.animalId);
      }

      if (
        [AnimalStatus.SOLD, AnimalStatus.DECEASED, AnimalStatus.CULLED].includes(
          animal.status
        )
      ) {
        throw new ValidationDomainException(
          `Cannot attribute expense to animal '${animal.tagNumber}' with status '${animal.status}'.`
        );
      }
    }

    // 2. Instantiate domain entity with domain validations
    const entity = FarmExpenseEntity.create({
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

    // 3. Atomically persist expense and emit audit log
    const created = await this.transactionManager.run(async (tx) => {
      const saved = await this.farmExpenseRepository.create(entity, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "CREATE_EXPENSE",
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
      `[TraceId: ${activeTraceId}] Expense recorded: ${created.id} (Category: ${created.category}, Amount: ${created.amount} ${created.currency}) by user ${actorUserId}`
    );

    return created.toDto();
  }

  public async updateExpense(
    farmId: string,
    id: string,
    actorUserId: string,
    dto: UpdateExpenseDto,
    traceId?: string
  ): Promise<ExpenseResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const existing = await this.farmExpenseRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("FarmExpense", id);
    }

    if (dto.animalId !== undefined && dto.animalId !== null) {
      const animal = await this.animalRepository.findById(dto.animalId, farmId);
      if (!animal) {
        throw new EntityNotFoundException("Animal", dto.animalId);
      }

      if (
        [AnimalStatus.SOLD, AnimalStatus.DECEASED, AnimalStatus.CULLED].includes(
          animal.status
        )
      ) {
        throw new ValidationDomainException(
          `Cannot attribute expense to animal '${animal.tagNumber}' with status '${animal.status}'.`
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
      const saved = await this.farmExpenseRepository.update(existing, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "UPDATE_EXPENSE",
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
      `[TraceId: ${activeTraceId}] Expense updated: ${updated.id} by user ${actorUserId}`
    );

    return updated.toDto();
  }

  public async getExpenseById(
    farmId: string,
    id: string
  ): Promise<ExpenseResponseDto> {
    const expense = await this.farmExpenseRepository.findById(id, farmId);
    if (!expense) {
      throw new EntityNotFoundException("FarmExpense", id);
    }
    return expense.toDto();
  }

  public async getExpenses(
    farmId: string,
    query: ExpenseQueryDto
  ): Promise<PaginatedExpensesDto> {
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

    const { items, total } = await this.farmExpenseRepository.findMany({
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

  public async getExpenseSummary(
    farmId: string,
    query: ExpenseSummaryQueryDto
  ): Promise<ExpenseSummaryResponseDto> {
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

    return this.farmExpenseRepository.getSummary({
      farmId,
      startDate,
      endDate,
      animalId: query.animalId,
    });
  }

  public async deleteExpense(
    farmId: string,
    id: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const existing = await this.farmExpenseRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("FarmExpense", id);
    }

    const oldValues = existing.toDto();

    existing.softDelete();

    await this.transactionManager.run(async (tx) => {
      await this.farmExpenseRepository.softDelete(existing, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "DELETE_EXPENSE",
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
      `[TraceId: ${activeTraceId}] Expense soft-deleted: ${existing.id} by user ${actorUserId}`
    );
  }
}
