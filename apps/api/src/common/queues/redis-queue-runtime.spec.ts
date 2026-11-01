import { Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { BullModule, Processor, WorkerHost, getQueueToken, RegisterQueueOptions } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { EnvService } from "../../config/env.service";
import { AppConfigModule } from "../../config";
import { HealthEscalationQueueService } from "../../modules/clinical-health/services/health-escalation-queue.service";
import { VaccineReminderQueueService } from "../../modules/clinical-health/services/vaccine-reminder-queue.service";
import { SubscriptionDunningQueueService } from "../../modules/subscriptions/services/subscription-dunning-queue.service";
import { RoleNotificationDispatcher } from "../../modules/role-notifications/role-notification-dispatcher.service";

jest.mock("../../config", () => {
  const { Module, Global } = require("@nestjs/common");
  const { EnvService } = require("../../config/env.service");
  class AppConfigModule {}
  Global()(AppConfigModule);
  Module({ providers: [{ provide: EnvService, useValue: {} }], exports: [EnvService] })(AppConfigModule);
  return { AppConfigModule, EnvService };
});
jest.mock("ioredis", () => ({ __esModule: true, default: jest.fn(() => { throw new Error("Redis construction forbidden"); }) }));

// Initial baseline delegates directly to current Bull registration.
const registerRuntimeQueues = (...options: RegisterQueueOptions[]) => BullModule.registerQueue(...options);
const registerRuntimeQueueRoot = () => BullModule.forRootAsync({ imports:[AppConfigModule], inject:[EnvService], useFactory: () => ({ connection: {host:"localhost"} }) });

@Processor("runtime-test")
@Injectable()
class RuntimeTestProcessor extends WorkerHost { async process() { return undefined; } }

describe("Redis runtime queue construction boundary", () => {
  beforeEach(() => jest.clearAllMocks());
  it("initializes Nest with real Bull providers/processors without any Redis client or worker", async () => {
    const module = await Test.createTestingModule({imports:[AppConfigModule, registerRuntimeQueueRoot(), registerRuntimeQueues({name:"runtime-test"})], providers:[RuntimeTestProcessor]})
      .overrideProvider(EnvService).useValue({ redisEnabled:false }).compile();
    try {
      await module.init();
      const queue = module.get<Queue>(getQueueToken("runtime-test"));
      await expect(queue.add("work", {})).rejects.toMatchObject({errorCode:"QUEUE_DISABLED",statusCode:503});
      await expect(queue.getJob("job")).rejects.toMatchObject({errorCode:"QUEUE_DISABLED",statusCode:503});
      expect(() => module.get(RuntimeTestProcessor).worker).toThrow();
      expect(Redis).not.toHaveBeenCalled();
    } finally { await module.close(); }
  });
  it("preserves real Bull queue options and worker registration when enabled", async () => {
    const queues: Array<{name:string;options:any}> = [], workerNames:string[] = [];
    class TestQueue { constructor(name:string, options:any) { queues.push({name,options}); } async close() {} }
    class TestWorker { constructor(name:string) {workerNames.push(name);} on() {} async close() {} }
    BullModule.queueClass = TestQueue as never;
    BullModule.workerClass = TestWorker as never;
    try {
      const module = await Test.createTestingModule({ imports:[AppConfigModule, registerRuntimeQueueRoot(), registerRuntimeQueues({name:"runtime-test",defaultJobOptions:{attempts:4}})],providers:[RuntimeTestProcessor] })
        .overrideProvider(EnvService).useValue({redisEnabled:true, redisUrl:"redis://localhost:6379"}).compile();
      try {
        await module.init();
        expect(module.get(getQueueToken("runtime-test"))).toBeInstanceOf(TestQueue);
        expect(queues).toEqual([{name:"runtime-test", options:expect.objectContaining({name:"runtime-test",defaultJobOptions:{attempts:4},connection:expect.objectContaining({host:"localhost"})})}]);
        expect(workerNames).toEqual(["runtime-test"]);
      } finally {await module.close();}
    } finally {
      const bull = jest.requireActual("bullmq");
      BullModule.queueClass = bull.Queue;
      BullModule.workerClass = bull.Worker;
    }
  });
});
