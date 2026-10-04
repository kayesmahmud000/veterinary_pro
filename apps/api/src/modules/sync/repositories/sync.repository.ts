import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  HealthEventType,
  MilkSession,
  SeverityLevel,
  SyncAnimalDto,
  SyncConflictItemDto,
  SyncHealthRecordDto,
  SyncMilkLogDto,
  SyncPullChangesMap,
  SyncPushTableChangesMap,
  SyncTransactionDto,
  SyncVaccineRecordDto,
  SyncWeightLogDto,
  TransactionCategory,
  TransactionType,
  VaccineRecordType,
} from "@vetralink/shared-types";
import { ISyncRepository } from "./sync.repository.interface";

@Injectable()
export class SyncRepository implements ISyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async pullFarmDeltas(
    farmId: string,
    since: Date | null
  ): Promise<SyncPullChangesMap> {
    if (!since) {
      // Initial full sync: all active records are returned as "created"
      const [animals, milkLogs, healthRecords, vaccineRecords, weightLogs, transactions] =
        await Promise.all([
          this.prisma.animal.findMany({
            where: { farmId, deletedAt: null },
            orderBy: { createdAt: "asc" },
          }),
          this.prisma.milkLog.findMany({
            where: { farmId },
            orderBy: { loggedDate: "asc" },
          }),
          this.prisma.healthRecord.findMany({
            where: { farmId },
            orderBy: { createdAt: "asc" },
          }),
          this.prisma.vaccineRecord.findMany({
            where: { farmId },
            orderBy: { administeredAt: "asc" },
          }),
          this.prisma.animalWeightLog.findMany({
            where: { farmId },
            orderBy: { recordedAt: "asc" },
          }),
          this.prisma.farmTransaction.findMany({
            where: { farmId, deletedAt: null },
            orderBy: { txDate: "asc" },
          }),
        ]);

      return {
        animals: {
          created: animals.map(this.mapAnimal),
          updated: [],
          deleted: [],
        },
        milkLogs: {
          created: milkLogs.map(this.mapMilkLog),
          updated: [],
          deleted: [],
        },
        healthRecords: {
          created: healthRecords.map(this.mapHealthRecord),
          updated: [],
          deleted: [],
        },
        vaccineRecords: {
          created: vaccineRecords.map(this.mapVaccineRecord),
          updated: [],
          deleted: [],
        },
        weightLogs: {
          created: weightLogs.map(this.mapWeightLog),
          updated: [],
          deleted: [],
        },
        transactions: {
          created: transactions.map(this.mapTransaction),
          updated: [],
          deleted: [],
        },
      };
    }

    // Delta sync: inspect changes since lastPulledAt
    const [
      deletedAnimals,
      createdAnimals,
      updatedAnimals,
      createdMilkLogs,
      updatedMilkLogs,
      createdHealthRecords,
      updatedHealthRecords,
      createdVaccineRecords,
      updatedVaccineRecords,
      createdWeightLogs,
      updatedWeightLogs,
      deletedTransactions,
      createdTransactions,
      updatedTransactions,
    ] = await Promise.all([
      this.prisma.animal.findMany({
        where: { farmId, deletedAt: { gt: since } },
        select: { id: true },
      }),
      this.prisma.animal.findMany({
        where: { farmId, createdAt: { gt: since }, deletedAt: null },
      }),
      this.prisma.animal.findMany({
        where: {
          farmId,
          updatedAt: { gt: since },
          createdAt: { lte: since },
          deletedAt: null,
        },
      }),

      this.prisma.milkLog.findMany({
        where: { farmId, createdAt: { gt: since } },
      }),
      this.prisma.milkLog.findMany({
        where: { farmId, updatedAt: { gt: since }, createdAt: { lte: since } },
      }),

      this.prisma.healthRecord.findMany({
        where: { farmId, createdAt: { gt: since } },
      }),
      this.prisma.healthRecord.findMany({
        where: { farmId, updatedAt: { gt: since }, createdAt: { lte: since } },
      }),

      this.prisma.vaccineRecord.findMany({
        where: { farmId, createdAt: { gt: since } },
      }),
      this.prisma.vaccineRecord.findMany({
        where: { farmId, updatedAt: { gt: since }, createdAt: { lte: since } },
      }),

      this.prisma.animalWeightLog.findMany({
        where: { farmId, createdAt: { gt: since } },
      }),
      this.prisma.animalWeightLog.findMany({
        where: { farmId, updatedAt: { gt: since }, createdAt: { lte: since } },
      }),

      this.prisma.farmTransaction.findMany({
        where: { farmId, deletedAt: { gt: since } },
        select: { id: true },
      }),
      this.prisma.farmTransaction.findMany({
        where: { farmId, createdAt: { gt: since }, deletedAt: null },
      }),
      this.prisma.farmTransaction.findMany({
        where: {
          farmId,
          updatedAt: { gt: since },
          createdAt: { lte: since },
          deletedAt: null,
        },
      }),
    ]);

    return {
      animals: {
        created: createdAnimals.map(this.mapAnimal),
        updated: updatedAnimals.map(this.mapAnimal),
        deleted: deletedAnimals.map((a) => a.id),
      },
      milkLogs: {
        created: createdMilkLogs.map(this.mapMilkLog),
        updated: updatedMilkLogs.map(this.mapMilkLog),
        deleted: [],
      },
      healthRecords: {
        created: createdHealthRecords.map(this.mapHealthRecord),
        updated: updatedHealthRecords.map(this.mapHealthRecord),
        deleted: [],
      },
      vaccineRecords: {
        created: createdVaccineRecords.map(this.mapVaccineRecord),
        updated: updatedVaccineRecords.map(this.mapVaccineRecord),
        deleted: [],
      },
      weightLogs: {
        created: createdWeightLogs.map(this.mapWeightLog),
        updated: updatedWeightLogs.map(this.mapWeightLog),
        deleted: [],
      },
      transactions: {
        created: createdTransactions.map(this.mapTransaction),
        updated: updatedTransactions.map(this.mapTransaction),
        deleted: deletedTransactions.map((t) => t.id),
      },
    };
  }

  public async applyPushMutations(
    farmId: string,
    userId: string,
    changes: SyncPushTableChangesMap,
    clientLastPulledAt: Date
  ): Promise<{
    appliedCounts: {
      animals: number;
      milkLogs: number;
      healthRecords: number;
      vaccineRecords: number;
      weightLogs: number;
      transactions: number;
    };
    conflicts: SyncConflictItemDto[];
  }> {
    return this.prisma.$transaction(async (tx) => {
      const appliedCounts = {
        animals: 0,
        milkLogs: 0,
        healthRecords: 0,
        vaccineRecords: 0,
        weightLogs: 0,
        transactions: 0,
      };
      const conflicts: SyncConflictItemDto[] = [];

      // ==========================================
      // 1. ANIMALS
      // ==========================================
      if (changes.animals) {
        // Created animals
        for (const animal of changes.animals.created || []) {
          const existing = await tx.animal.findUnique({
            where: { id: animal.id },
          });

          if (existing) {
            // Already exists on server -> treat as update or duplicate
            if (existing.updatedAt > clientLastPulledAt) {
              conflicts.push({
                table: "animals",
                recordId: animal.id,
                reason: "Animal already exists with newer server modification",
                resolution: "SERVER_WINS",
                serverVersion: existing.syncVersion,
                clientVersion: animal.syncVersion,
              });
            } else {
              await tx.animal.update({
                where: { id: animal.id },
                data: {
                  name: animal.name,
                  species: animal.species,
                  breed: animal.breed,
                  gender: animal.gender,
                  dateOfBirth: animal.dateOfBirth ? new Date(animal.dateOfBirth) : null,
                  weightKg: animal.weightKg !== undefined && animal.weightKg !== null ? new Prisma.Decimal(animal.weightKg) : null,
                  status: animal.status,
                  sireId: animal.sireId ?? null,
                  damId: animal.damId ?? null,
                  metadata: animal.metadata ? (animal.metadata as Prisma.InputJsonValue) : {},
                  syncVersion: existing.syncVersion + 1,
                },
              });
              appliedCounts.animals++;
            }
          } else {
            // Check active tag uniqueness on farm
            const duplicateTag = await tx.animal.findFirst({
              where: { farmId, tagNumber: animal.tagNumber, deletedAt: null },
            });

            if (duplicateTag) {
              conflicts.push({
                table: "animals",
                recordId: animal.id,
                reason: `Ear tag number '${animal.tagNumber}' already exists on farm`,
                resolution: "SERVER_WINS",
              });
            } else {
              await tx.animal.create({
                data: {
                  id: animal.id,
                  farmId,
                  tagNumber: animal.tagNumber,
                  rfidNumber: animal.rfidNumber ?? null,
                  name: animal.name ?? null,
                  species: animal.species,
                  breed: animal.breed ?? null,
                  gender: animal.gender,
                  dateOfBirth: animal.dateOfBirth ? new Date(animal.dateOfBirth) : null,
                  weightKg: animal.weightKg !== undefined && animal.weightKg !== null ? new Prisma.Decimal(animal.weightKg) : null,
                  status: animal.status ?? AnimalStatus.ACTIVE,
                  sireId: animal.sireId ?? null,
                  damId: animal.damId ?? null,
                  metadata: animal.metadata ? (animal.metadata as Prisma.InputJsonValue) : {},
                  syncVersion: 1,
                },
              });
              appliedCounts.animals++;
            }
          }
        }

        // Updated animals
        for (const animal of changes.animals.updated || []) {
          const existing = await tx.animal.findUnique({
            where: { id: animal.id },
          });

          if (!existing || existing.deletedAt) {
            conflicts.push({
              table: "animals",
              recordId: animal.id,
              reason: "Animal does not exist or has been deleted on server",
              resolution: "SERVER_WINS",
            });
          } else if (
            existing.updatedAt > clientLastPulledAt &&
            existing.syncVersion > animal.syncVersion
          ) {
            conflicts.push({
              table: "animals",
              recordId: animal.id,
              reason: "Server version is newer than client edit watermark",
              resolution: "SERVER_WINS",
              serverVersion: existing.syncVersion,
              clientVersion: animal.syncVersion,
            });
          } else {
            await tx.animal.update({
              where: { id: animal.id },
              data: {
                name: animal.name,
                species: animal.species,
                breed: animal.breed,
                gender: animal.gender,
                dateOfBirth: animal.dateOfBirth ? new Date(animal.dateOfBirth) : null,
                weightKg: animal.weightKg !== undefined && animal.weightKg !== null ? new Prisma.Decimal(animal.weightKg) : null,
                status: animal.status,
                sireId: animal.sireId ?? null,
                damId: animal.damId ?? null,
                metadata: animal.metadata ? (animal.metadata as Prisma.InputJsonValue) : {},
                syncVersion: existing.syncVersion + 1,
              },
            });
            appliedCounts.animals++;
          }
        }

        // Deleted animals
        for (const id of changes.animals.deleted || []) {
          const result = await tx.animal.updateMany({
            where: { id, farmId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          if (result.count > 0) {
            appliedCounts.animals++;
          }
        }
      }

      // ==========================================
      // 2. MILK LOGS
      // ==========================================
      if (changes.milkLogs) {
        for (const log of changes.milkLogs.created || []) {
          const existing = await tx.milkLog.findUnique({
            where: { id: log.id },
          });

          if (!existing) {
            await tx.milkLog.create({
              data: {
                id: log.id,
                farmId,
                animalId: log.animalId ?? null,
                recordedById: userId,
                session: log.session,
                yieldLiters: new Prisma.Decimal(log.yieldLiters),
                fatPercent: log.fatPercent !== undefined && log.fatPercent !== null ? new Prisma.Decimal(log.fatPercent) : null,
                snfPercent: log.snfPercent !== undefined && log.snfPercent !== null ? new Prisma.Decimal(log.snfPercent) : null,
                loggedDate: new Date(log.loggedDate),
                syncVersion: 1,
              },
            });
            appliedCounts.milkLogs++;
          }
        }

        for (const log of changes.milkLogs.updated || []) {
          const existing = await tx.milkLog.findUnique({
            where: { id: log.id },
          });

          if (existing) {
            if (
              existing.updatedAt > clientLastPulledAt &&
              existing.syncVersion > log.syncVersion
            ) {
              conflicts.push({
                table: "milkLogs",
                recordId: log.id,
                reason: "Server version is newer than client edit watermark",
                resolution: "SERVER_WINS",
                serverVersion: existing.syncVersion,
                clientVersion: log.syncVersion,
              });
            } else {
              await tx.milkLog.update({
                where: { id: log.id },
                data: {
                  yieldLiters: new Prisma.Decimal(log.yieldLiters),
                  fatPercent: log.fatPercent !== undefined && log.fatPercent !== null ? new Prisma.Decimal(log.fatPercent) : null,
                  snfPercent: log.snfPercent !== undefined && log.snfPercent !== null ? new Prisma.Decimal(log.snfPercent) : null,
                  syncVersion: existing.syncVersion + 1,
                },
              });
              appliedCounts.milkLogs++;
            }
          }
        }

        for (const id of changes.milkLogs.deleted || []) {
          const result = await tx.milkLog.deleteMany({
            where: { id, farmId },
          });
          if (result.count > 0) {
            appliedCounts.milkLogs++;
          }
        }
      }

      // ==========================================
      // 3. HEALTH RECORDS
      // ==========================================
      if (changes.healthRecords) {
        for (const rec of changes.healthRecords.created || []) {
          const existing = await tx.healthRecord.findUnique({
            where: { id: rec.id },
          });

          if (!existing) {
            await tx.healthRecord.create({
              data: {
                id: rec.id,
                farmId,
                animalId: rec.animalId,
                recordedById: userId,
                attendingVetId: rec.attendingVetId ?? null,
                eventType: rec.eventType,
                severity: rec.severity,
                symptoms: rec.symptoms,
                diagnosis: rec.diagnosis ?? null,
                treatment: rec.treatment ?? null,
                cost: new Prisma.Decimal(rec.cost ?? 0),
                resolvedAt: rec.resolvedAt ? new Date(rec.resolvedAt) : null,
                syncVersion: 1,
              },
            });
            appliedCounts.healthRecords++;
          }
        }

        for (const rec of changes.healthRecords.updated || []) {
          const existing = await tx.healthRecord.findUnique({
            where: { id: rec.id },
          });

          if (existing) {
            if (
              existing.updatedAt > clientLastPulledAt &&
              existing.syncVersion > rec.syncVersion
            ) {
              conflicts.push({
                table: "healthRecords",
                recordId: rec.id,
                reason: "Server version is newer than client edit watermark",
                resolution: "SERVER_WINS",
                serverVersion: existing.syncVersion,
                clientVersion: rec.syncVersion,
              });
            } else {
              await tx.healthRecord.update({
                where: { id: rec.id },
                data: {
                  severity: rec.severity,
                  symptoms: rec.symptoms,
                  diagnosis: rec.diagnosis ?? null,
                  treatment: rec.treatment ?? null,
                  cost: new Prisma.Decimal(rec.cost ?? 0),
                  resolvedAt: rec.resolvedAt ? new Date(rec.resolvedAt) : null,
                  syncVersion: existing.syncVersion + 1,
                },
              });
              appliedCounts.healthRecords++;
            }
          }
        }

        for (const id of changes.healthRecords.deleted || []) {
          const result = await tx.healthRecord.deleteMany({
            where: { id, farmId },
          });
          if (result.count > 0) {
            appliedCounts.healthRecords++;
          }
        }
      }

      // ==========================================
      // 4. VACCINE RECORDS
      // ==========================================
      if (changes.vaccineRecords) {
        for (const rec of changes.vaccineRecords.created || []) {
          const existing = await tx.vaccineRecord.findUnique({
            where: { id: rec.id },
          });

          if (!existing) {
            await tx.vaccineRecord.create({
              data: {
                id: rec.id,
                farmId,
                animalId: rec.animalId,
                administeredBy: userId,
                recordType: rec.recordType ?? VaccineRecordType.VACCINATION,
                vaccineName: rec.vaccineName,
                batchNumber: rec.batchNumber ?? null,
                doseAmount: new Prisma.Decimal(rec.doseAmount),
                doseUnit: rec.doseUnit ?? "ml",
                cost: new Prisma.Decimal(rec.cost ?? 0),
                notes: rec.notes ?? null,
                administeredAt: new Date(rec.administeredAt),
                nextDueDate: rec.nextDueDate ? new Date(rec.nextDueDate) : null,
                syncVersion: 1,
              },
            });
            appliedCounts.vaccineRecords++;
          }
        }

        for (const rec of changes.vaccineRecords.updated || []) {
          const existing = await tx.vaccineRecord.findUnique({
            where: { id: rec.id },
          });

          if (existing) {
            if (
              existing.updatedAt > clientLastPulledAt &&
              existing.syncVersion > rec.syncVersion
            ) {
              conflicts.push({
                table: "vaccineRecords",
                recordId: rec.id,
                reason: "Server version is newer than client edit watermark",
                resolution: "SERVER_WINS",
                serverVersion: existing.syncVersion,
                clientVersion: rec.syncVersion,
              });
            } else {
              await tx.vaccineRecord.update({
                where: { id: rec.id },
                data: {
                  vaccineName: rec.vaccineName,
                  batchNumber: rec.batchNumber ?? null,
                  doseAmount: new Prisma.Decimal(rec.doseAmount),
                  doseUnit: rec.doseUnit ?? "ml",
                  cost: new Prisma.Decimal(rec.cost ?? 0),
                  notes: rec.notes ?? null,
                  administeredAt: new Date(rec.administeredAt),
                  nextDueDate: rec.nextDueDate ? new Date(rec.nextDueDate) : null,
                  syncVersion: existing.syncVersion + 1,
                },
              });
              appliedCounts.vaccineRecords++;
            }
          }
        }

        for (const id of changes.vaccineRecords.deleted || []) {
          const result = await tx.vaccineRecord.deleteMany({
            where: { id, farmId },
          });
          if (result.count > 0) {
            appliedCounts.vaccineRecords++;
          }
        }
      }

      // ==========================================
      // 5. WEIGHT LOGS
      // ==========================================
      if (changes.weightLogs) {
        for (const log of changes.weightLogs.created || []) {
          const existing = await tx.animalWeightLog.findUnique({
            where: { id: log.id },
          });

          if (!existing) {
            await tx.animalWeightLog.create({
              data: {
                id: log.id,
                farmId,
                animalId: log.animalId,
                recordedById: userId,
                weightKg: new Prisma.Decimal(log.weightKg),
                recordedAt: new Date(log.recordedAt),
                notes: log.notes ?? null,
                syncVersion: 1,
              },
            });
            appliedCounts.weightLogs++;
          }
        }

        for (const log of changes.weightLogs.updated || []) {
          const existing = await tx.animalWeightLog.findUnique({
            where: { id: log.id },
          });

          if (existing) {
            if (
              existing.updatedAt > clientLastPulledAt &&
              existing.syncVersion > log.syncVersion
            ) {
              conflicts.push({
                table: "weightLogs",
                recordId: log.id,
                reason: "Server version is newer than client edit watermark",
                resolution: "SERVER_WINS",
                serverVersion: existing.syncVersion,
                clientVersion: log.syncVersion,
              });
            } else {
              await tx.animalWeightLog.update({
                where: { id: log.id },
                data: {
                  weightKg: new Prisma.Decimal(log.weightKg),
                  notes: log.notes ?? null,
                  syncVersion: existing.syncVersion + 1,
                },
              });
              appliedCounts.weightLogs++;
            }
          }
        }

        for (const id of changes.weightLogs.deleted || []) {
          const result = await tx.animalWeightLog.deleteMany({
            where: { id, farmId },
          });
          if (result.count > 0) {
            appliedCounts.weightLogs++;
          }
        }
      }

      // ==========================================
      // 6. TRANSACTIONS
      // ==========================================
      if (changes.transactions) {
        for (const t of changes.transactions.created || []) {
          const existing = await tx.farmTransaction.findUnique({
            where: { id: t.id },
          });

          if (!existing) {
            await tx.farmTransaction.create({
              data: {
                id: t.id,
                farmId,
                recordedById: userId,
                animalId: t.animalId ?? null,
                type: t.type,
                category: t.category,
                amount: new Prisma.Decimal(t.amount),
                currency: t.currency ?? "USD",
                referenceNote: t.referenceNote ?? null,
                receiptUrl: t.receiptUrl ?? null,
                txDate: new Date(t.txDate),
                syncVersion: 1,
              },
            });
            appliedCounts.transactions++;
          }
        }

        for (const t of changes.transactions.updated || []) {
          const existing = await tx.farmTransaction.findUnique({
            where: { id: t.id },
          });

          if (existing && !existing.deletedAt) {
            if (
              existing.updatedAt > clientLastPulledAt &&
              existing.syncVersion > t.syncVersion
            ) {
              conflicts.push({
                table: "transactions",
                recordId: t.id,
                reason: "Server version is newer than client edit watermark",
                resolution: "SERVER_WINS",
                serverVersion: existing.syncVersion,
                clientVersion: t.syncVersion,
              });
            } else {
              await tx.farmTransaction.update({
                where: { id: t.id },
                data: {
                  amount: new Prisma.Decimal(t.amount),
                  type: t.type,
                  category: t.category,
                  referenceNote: t.referenceNote ?? null,
                  syncVersion: existing.syncVersion + 1,
                },
              });
              appliedCounts.transactions++;
            }
          }
        }

        for (const id of changes.transactions.deleted || []) {
          const result = await tx.farmTransaction.updateMany({
            where: { id, farmId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          if (result.count > 0) {
            appliedCounts.transactions++;
          }
        }
      }

      return { appliedCounts, conflicts };
    });
  }

  public async getFarmSyncSummary(farmId: string): Promise<{
    animals: number;
    milkLogs: number;
    healthRecords: number;
    vaccineRecords: number;
    weightLogs: number;
    transactions: number;
  }> {
    const [animals, milkLogs, healthRecords, vaccineRecords, weightLogs, transactions] =
      await Promise.all([
        this.prisma.animal.count({ where: { farmId, deletedAt: null } }),
        this.prisma.milkLog.count({ where: { farmId } }),
        this.prisma.healthRecord.count({ where: { farmId } }),
        this.prisma.vaccineRecord.count({ where: { farmId } }),
        this.prisma.animalWeightLog.count({ where: { farmId } }),
        this.prisma.farmTransaction.count({ where: { farmId, deletedAt: null } }),
      ]);

    return {
      animals,
      milkLogs,
      healthRecords,
      vaccineRecords,
      weightLogs,
      transactions,
    };
  }

  // ==========================================
  // Private Mappers
  // ==========================================

  private mapAnimal(record: any): SyncAnimalDto {
    return {
      id: record.id,
      farmId: record.farmId,
      tagNumber: record.tagNumber,
      rfidNumber: record.rfidNumber,
      name: record.name,
      species: record.species as AnimalSpecies,
      breed: record.breed,
      gender: record.gender as AnimalGender,
      dateOfBirth: record.dateOfBirth ? record.dateOfBirth.toISOString() : null,
      weightKg: record.weightKg ? Number(record.weightKg) : null,
      status: record.status as AnimalStatus,
      sireId: record.sireId,
      damId: record.damId,
      metadata: record.metadata as Record<string, unknown>,
      syncVersion: record.syncVersion,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    };
  }

  private mapMilkLog(record: any): SyncMilkLogDto {
    return {
      id: record.id,
      farmId: record.farmId,
      animalId: record.animalId,
      recordedById: record.recordedById,
      session: record.session as MilkSession,
      yieldLiters: Number(record.yieldLiters),
      fatPercent: record.fatPercent ? Number(record.fatPercent) : null,
      snfPercent: record.snfPercent ? Number(record.snfPercent) : null,
      loggedDate: record.loggedDate.toISOString(),
      syncVersion: record.syncVersion,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapHealthRecord(record: any): SyncHealthRecordDto {
    return {
      id: record.id,
      farmId: record.farmId,
      animalId: record.animalId,
      recordedById: record.recordedById,
      attendingVetId: record.attendingVetId,
      eventType: record.eventType as HealthEventType,
      severity: record.severity as SeverityLevel,
      symptoms: record.symptoms,
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      cost: Number(record.cost),
      resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : null,
      syncVersion: record.syncVersion,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapVaccineRecord(record: any): SyncVaccineRecordDto {
    return {
      id: record.id,
      farmId: record.farmId,
      animalId: record.animalId,
      administeredBy: record.administeredBy,
      recordType: record.recordType as VaccineRecordType,
      vaccineName: record.vaccineName,
      batchNumber: record.batchNumber,
      doseAmount: Number(record.doseAmount),
      doseUnit: record.doseUnit,
      cost: Number(record.cost),
      notes: record.notes,
      administeredAt: record.administeredAt.toISOString(),
      nextDueDate: record.nextDueDate ? record.nextDueDate.toISOString() : null,
      syncVersion: record.syncVersion,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapWeightLog(record: any): SyncWeightLogDto {
    return {
      id: record.id,
      farmId: record.farmId,
      animalId: record.animalId,
      recordedById: record.recordedById,
      weightKg: Number(record.weightKg),
      recordedAt: record.recordedAt.toISOString(),
      notes: record.notes,
      syncVersion: record.syncVersion,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapTransaction(record: any): SyncTransactionDto {
    return {
      id: record.id,
      farmId: record.farmId,
      recordedById: record.recordedById,
      animalId: record.animalId,
      type: record.type as TransactionType,
      category: record.category as TransactionCategory,
      amount: Number(record.amount),
      currency: record.currency,
      referenceNote: record.referenceNote,
      receiptUrl: record.receiptUrl,
      txDate: record.txDate.toISOString(),
      syncVersion: record.syncVersion,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    };
  }
}
