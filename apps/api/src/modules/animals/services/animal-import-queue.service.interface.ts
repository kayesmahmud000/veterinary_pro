export const ANIMAL_IMPORT_QUEUE = "animal-import";
export const ANIMAL_IMPORT_QUEUE_SERVICE = Symbol("ANIMAL_IMPORT_QUEUE_SERVICE");

export interface AnimalImportJobPayload {
  jobId: string;
  farmId: string;
  filePath: string;
  actorUserId: string;
  traceId?: string;
}

export interface IAnimalImportQueueService {
  enqueueImportJob(payload: AnimalImportJobPayload): Promise<void>;
}
