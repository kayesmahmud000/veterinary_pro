import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma";
import { AuditModule } from "../audit";
import { FarmsModule } from "../farms";
import { AnimalRepository } from "./repositories/animal.repository";
import { ANIMAL_REPOSITORY } from "./repositories/animal.repository.interface";
import { AnimalsService } from "./services/animals.service";
import { ANIMALS_SERVICE } from "./services/animals.service.interface";
import { AnimalsController } from "./animals.controller";

@Module({
  imports: [PrismaModule, AuditModule, FarmsModule],
  controllers: [AnimalsController],
  providers: [
    {
      provide: ANIMAL_REPOSITORY,
      useClass: AnimalRepository,
    },
    {
      provide: ANIMALS_SERVICE,
      useClass: AnimalsService,
    },
    AnimalRepository,
    AnimalsService,
  ],
  exports: [
    ANIMAL_REPOSITORY,
    ANIMALS_SERVICE,
    AnimalRepository,
    AnimalsService,
  ],
})
export class AnimalsModule {}
