import { Inject, Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { HealthEscalationJobPayload } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import {
  HEALTH_ESCALATION_SERVICE,
  IHealthEscalationService,
} from "../services/health-escalation.service.interface";
import { HEALTH_ESCALATION_QUEUE } from "../services/health-escalation-queue.service.interface";

@Injectable()
@Processor(HEALTH_ESCALATION_QUEUE)
export class HealthEscalationProcessor extends WorkerHost {
  private readonly logger = new Logger(HealthEscalationProcessor.name);

  constructor(
    @Inject(HEALTH_ESCALATION_SERVICE)
    private readonly escalationService: IHealthEscalationService,
    private readonly prisma: PrismaService
  ) {
    super();
  }

  public async process(job: Job<HealthEscalationJobPayload>): Promise<unknown> {
    const {
      jobType,
      farmId,
      asOfDate,
      dryRun,
      traceId,
    } = job.data;

    this.logger.log(
      `Processing health escalation job [${job.id}] type [${jobType}] for farm [${farmId ?? "ALL"}]`
    );

    const parsedDate = asOfDate ? new Date(asOfDate) : undefined;

    if (jobType === "SCAN_ALL_FARMS") {
      await job.updateProgress(10);
      const activeFarms = await this.prisma.farm.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      });

      this.logger.log(
        `SCAN_ALL_FARMS: Scanning ${activeFarms.length} active farms for unresolved critical illnesses`
      );

      const summaries = [];
      const totalFarms = activeFarms.length;
      let completedFarms = 0;

      for (const farm of activeFarms) {
        try {
          const summary =
            await this.escalationService.processFarmEscalations(
              farm.id,
              parsedDate,
              dryRun ?? false,
              traceId
            );
          summaries.push(summary);
        } catch (farmErr) {
          this.logger.error(
            `Failed scanning escalations for farm [${farm.id}] (${farm.name}): ${(farmErr as Error).message}`
          );
        }
        completedFarms++;
        const progress = Math.round(
          10 + (completedFarms / Math.max(1, totalFarms)) * 85
        );
        await job.updateProgress(progress);
      }

      await job.updateProgress(100);
      return {
        totalFarms: activeFarms.length,
        processedFarms: summaries.length,
        summaries,
      };
    }

    if (jobType === "SCAN_FARM") {
      if (!farmId) {
        throw new Error(
          `Invalid SCAN_FARM job [${job.id}]: farmId is required.`
        );
      }

      await job.updateProgress(25);
      const result = await this.escalationService.processFarmEscalations(
        farmId,
        parsedDate,
        dryRun ?? false,
        traceId
      );
      await job.updateProgress(100);
      return result;
    }

    if (jobType === "ESCALATE_INCIDENT") {
      if (!farmId) {
        throw new Error(
          `Invalid ESCALATE_INCIDENT job [${job.id}]: farmId is required.`
        );
      }

      await job.updateProgress(50);
      const result = await this.escalationService.processFarmEscalations(
        farmId,
        parsedDate,
        dryRun ?? false,
        traceId
      );
      await job.updateProgress(100);
      return result;
    }

    throw new Error(`Unsupported job type [${jobType}] on health escalation queue.`);
  }
}
