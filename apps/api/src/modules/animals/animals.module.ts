import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../prisma";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { FarmsModule } from "../farms";
import { AnimalRepository } from "./repositories/animal.repository";
import { ANIMAL_REPOSITORY } from "./repositories/animal.repository.interface";
import { AnimalWeightRepository } from "./repositories/animal-weight.repository";
import { ANIMAL_WEIGHT_REPOSITORY } from "./repositories/animal-weight.repository.interface";
import { AnimalImportJobRepository } from "./repositories/animal-import-job.repository";
import { ANIMAL_IMPORT_JOB_REPOSITORY } from "./repositories/animal-import-job.repository.interface";
import {
  ANIMAL_IMPORT_QUEUE,
  ANIMAL_IMPORT_QUEUE_SERVICE,
} from "./services/animal-import-queue.service.interface";
import { AnimalImportQueueService } from "./services/animal-import-queue.service";
import { AnimalImportProcessor } from "./processors/animal-import.processor";
import { AnimalsService } from "./services/animals.service";
import { ANIMALS_SERVICE } from "./services/animals.service.interface";
import { AnimalTagService } from "./services/animal-tag.service";
import { ANIMAL_TAG_SERVICE } from "./services/animal-tag.service.interface";
import { AnimalsController } from "./animals.controller";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    FarmsModule,
    BullModule.registerQueue({
      name: ANIMAL_IMPORT_QUEUE,
    }),
  ],
  controllers: [AnimalsController],
  providers: [
    {
      provide: ANIMAL_REPOSITORY,
      useClass: AnimalRepository,
    },
    {
      provide: ANIMAL_WEIGHT_REPOSITORY,
      useClass: AnimalWeightRepository,
    },
    {
      provide: ANIMAL_IMPORT_JOB_REPOSITORY,
      useClass: AnimalImportJobRepository,
    },
    {
      provide: ANIMAL_IMPORT_QUEUE_SERVICE,
      useClass: AnimalImportQueueService,
    },
    {
      provide: ANIMAL_TAG_SERVICE,
      useClass: AnimalTagService,
    },
    {
      provide: ANIMALS_SERVICE,
      useClass: AnimalsService,
    },
    AnimalRepository,
    AnimalWeightRepository,
    AnimalImportJobRepository,
    AnimalImportQueueService,
    AnimalImportProcessor,
    AnimalTagService,
    AnimalsService,
  ],
  exports: [
    ANIMAL_REPOSITORY,
    ANIMAL_WEIGHT_REPOSITORY,
    ANIMAL_IMPORT_JOB_REPOSITORY,
    ANIMAL_IMPORT_QUEUE_SERVICE,
    ANIMAL_TAG_SERVICE,
    ANIMALS_SERVICE,
    AnimalRepository,
    AnimalWeightRepository,
    AnimalImportJobRepository,
    AnimalImportQueueService,
    AnimalTagService,
    AnimalsService,
  ],
})
export class AnimalsModule {}
