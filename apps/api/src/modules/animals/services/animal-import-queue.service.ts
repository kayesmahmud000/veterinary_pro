import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  ANIMAL_IMPORT_QUEUE,
  AnimalImportJobPayload,
  IAnimalImportQueueService,
} from "./animal-import-queue.service.interface";

@Injectable()
export class AnimalImportQueueService implements IAnimalImportQueueService {
  private readonly logger = new Logger(AnimalImportQueueService.name);

  constructor(
    @InjectQueue(ANIMAL_IMPORT_QUEUE)
    private readonly queue: Queue<AnimalImportJobPayload>
  ) {}

  public async enqueueImportJob(payload: AnimalImportJobPayload): Promise<void> {
    this.logger.log(
      `Enqueuing bulk animal import job [${payload.jobId}] for farm [${payload.farmId}]`
    );

    await this.queue.add("process-import", payload, {
      jobId: payload.jobId,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
