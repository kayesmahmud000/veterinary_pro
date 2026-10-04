import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { MilkAnomalyJobPayload } from "@vetralink/shared-types";
import {
  IMilkAnomalyQueueService,
  MILK_ANOMALY_QUEUE,
} from "./milk-anomaly-queue.service.interface";

@Injectable()
export class MilkAnomalyQueueService implements IMilkAnomalyQueueService {
  private readonly logger = new Logger(MilkAnomalyQueueService.name);

  constructor(
    @InjectQueue(MILK_ANOMALY_QUEUE)
    private readonly queue: Queue<MilkAnomalyJobPayload>
  ) {}

  public async dispatchAnimalDropCheck(
    farmId: string,
    animalId: string,
    loggedDate: string,
    traceId?: string
  ): Promise<string> {
    const jobId = `animal-drop-${farmId}-${animalId}-${loggedDate}`;
    const job = await this.queue.add(
      "ANIMAL_DROP_CHECK",
      {
        jobType: "ANIMAL_DROP_CHECK",
        farmId,
        animalId,
        loggedDate,
        traceId: traceId ?? crypto.randomUUID(),
      },
      {
        jobId,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      }
    );

    this.logger.log(
      `Dispatched ANIMAL_DROP_CHECK job [${job.id}] for animal [${animalId}] on ${loggedDate}`
    );
    return job.id!;
  }

  public async dispatchFarmDailyScan(
    farmId: string,
    targetDate: string,
    actorUserId: string,
    traceId?: string
  ): Promise<string> {
    const jobId = `farm-scan-${farmId}-${targetDate}-${Date.now()}`;
    const job = await this.queue.add(
      "FARM_DAILY_SCAN",
      {
        jobType: "FARM_DAILY_SCAN",
        farmId,
        loggedDate: targetDate,
        actorUserId,
        traceId: traceId ?? crypto.randomUUID(),
      },
      {
        jobId,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 3000,
        },
      }
    );

    this.logger.log(
      `Dispatched FARM_DAILY_SCAN job [${job.id}] for farm [${farmId}] on ${targetDate}`
    );
    return job.id!;
  }
}
