import { Inject, Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { MilkAnomalyJobPayload } from "@vetralink/shared-types";
import {
  IMilkAnomalyService,
  MILK_ANOMALY_SERVICE,
} from "../services/milk-anomaly.service.interface";
import { MILK_ANOMALY_QUEUE } from "../services/milk-anomaly-queue.service.interface";
import { parseYmdToDate } from "../utils/milk-yield-analytics.util";

@Injectable()
@Processor(MILK_ANOMALY_QUEUE)
export class MilkAnomalyProcessor extends WorkerHost {
  private readonly logger = new Logger(MilkAnomalyProcessor.name);

  constructor(
    @Inject(MILK_ANOMALY_SERVICE)
    private readonly anomalyService: IMilkAnomalyService
  ) {
    super();
  }

  public async process(job: Job<MilkAnomalyJobPayload>): Promise<unknown> {
    const { jobType, farmId, animalId, loggedDate, actorUserId, traceId } =
      job.data;

    this.logger.log(
      `Processing milk anomaly job [${job.id}] type [${jobType}] for farm [${farmId}] on ${loggedDate}`
    );

    const parsedDate = parseYmdToDate(loggedDate);

    if (jobType === "ANIMAL_DROP_CHECK") {
      if (!animalId) {
        throw new Error(
          `Invalid ANIMAL_DROP_CHECK job [${job.id}]: animalId is required.`
        );
      }
      await job.updateProgress(25);
      const result = await this.anomalyService.evaluateAnimalYieldDrop(
        farmId,
        animalId,
        parsedDate,
        traceId
      );
      await job.updateProgress(100);

      if (result) {
        this.logger.warn(
          `ANOMALY FLAGGED for animal [${animalId}] on ${loggedDate}: -${result.dropPercentage}% drop [severity: ${result.severity}]`
        );
      } else {
        this.logger.log(
          `No anomaly detected for animal [${animalId}] on ${loggedDate}`
        );
      }

      return result;
    }

    if (jobType === "FARM_DAILY_SCAN") {
      await job.updateProgress(20);
      const scanResult = await this.anomalyService.runFarmDailyScan(
        farmId,
        parsedDate,
        actorUserId,
        traceId
      );
      await job.updateProgress(100);

      this.logger.log(
        `Completed farm scan [${farmId}] on ${loggedDate}: scanned ${scanResult.scannedAnimalsCount} animals, flagged ${scanResult.anomaliesDetectedCount} anomalies`
      );

      return scanResult;
    }

    throw new Error(`Unknown jobType '${jobType}' in job [${job.id}]`);
  }
}
