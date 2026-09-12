import { Injectable, Logger } from "@nestjs/common";
import { Prisma, ImportJobStatus as PrismaImportJobStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AnimalImportJobEntity } from "../entities/animal-import-job.entity";
import { IAnimalImportJobRepository } from "./animal-import-job.repository.interface";
import { AnimalImportRowErrorDto, ImportJobStatus } from "@vetralink/shared-types";

@Injectable()
export class AnimalImportJobRepository implements IAnimalImportJobRepository {
  private readonly logger = new Logger(AnimalImportJobRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(job: AnimalImportJobEntity): Promise<AnimalImportJobEntity> {
    const created = await this.prisma.animalImportJob.create({
      data: {
        id: job.id,
        farmId: job.farmId,
        uploadedById: job.uploadedById,
        fileName: job.fileName,
        fileSize: job.fileSize,
        fileType: job.fileType,
        status: job.status as unknown as PrismaImportJobStatus,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        successfulRows: job.successfulRows,
        failedRows: job.failedRows,
        errorReport: (job.errorReport as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        filePath: job.filePath,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
    });

    return this.toEntity(created);
  }

  public async findById(id: string, farmId: string): Promise<AnimalImportJobEntity | null> {
    const record = await this.prisma.animalImportJob.findFirst({
      where: {
        id,
        farmId,
      },
    });

    if (!record) {
      return null;
    }

    return this.toEntity(record);
  }

  public async findByFarmId(
    farmId: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ items: AnimalImportJobEntity[]; total: number }> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AnimalImportJobWhereInput = { farmId };

    const [records, total] = await Promise.all([
      this.prisma.animalImportJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.animalImportJob.count({ where }),
    ]);

    return {
      items: records.map((record) => this.toEntity(record)),
      total,
    };
  }

  public async update(job: AnimalImportJobEntity): Promise<AnimalImportJobEntity> {
    const updated = await this.prisma.animalImportJob.update({
      where: { id: job.id },
      data: {
        status: job.status as unknown as PrismaImportJobStatus,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        successfulRows: job.successfulRows,
        failedRows: job.failedRows,
        errorReport: (job.errorReport as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        filePath: job.filePath,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        updatedAt: new Date(),
      },
    });

    return this.toEntity(updated);
  }

  private toEntity(record: {
    id: string;
    farmId: string;
    uploadedById: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    status: string;
    totalRows: number;
    processedRows: number;
    successfulRows: number;
    failedRows: number;
    errorReport: unknown;
    filePath: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AnimalImportJobEntity {
    return AnimalImportJobEntity.reconstitute({
      id: record.id,
      farmId: record.farmId,
      uploadedById: record.uploadedById,
      fileName: record.fileName,
      fileSize: record.fileSize,
      fileType: record.fileType,
      status: record.status as ImportJobStatus,
      totalRows: record.totalRows,
      processedRows: record.processedRows,
      successfulRows: record.successfulRows,
      failedRows: record.failedRows,
      errorReport: Array.isArray(record.errorReport)
        ? (record.errorReport as AnimalImportRowErrorDto[])
        : null,
      filePath: record.filePath,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
