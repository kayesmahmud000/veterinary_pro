export const MILK_ANOMALY_QUEUE = "milk-anomaly-detection";
export const MILK_ANOMALY_QUEUE_SERVICE = "MILK_ANOMALY_QUEUE_SERVICE";

export interface IMilkAnomalyQueueService {
  dispatchAnimalDropCheck(
    farmId: string,
    animalId: string,
    loggedDate: string,
    traceId?: string
  ): Promise<string>;

  dispatchFarmDailyScan(
    farmId: string,
    targetDate: string,
    actorUserId: string,
    traceId?: string
  ): Promise<string>;
}
