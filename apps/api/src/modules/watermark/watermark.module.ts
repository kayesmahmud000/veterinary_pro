import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { MediaModule } from "../media/media.module";
import { WATERMARK_QUEUE } from "./services/watermark-queue.service.interface";
import { PdfWatermarkService } from "./services/pdf-watermark.service";
import { PDF_WATERMARK_SERVICE } from "./services/pdf-watermark.service.interface";
import { WatermarkQueueService } from "./services/watermark-queue.service";
import { WATERMARK_QUEUE_SERVICE } from "./services/watermark-queue.service.interface";
import { WatermarkProcessor } from "./processors/watermark.processor";

import { QrCodeService } from "./services/qr-code.service";
import { QR_CODE_SERVICE } from "./services/qr-code.service.interface";

@Module({
  imports: [
    MediaModule,
    BullModule.registerQueue({
      name: WATERMARK_QUEUE,
    }),
  ],
  providers: [
    QrCodeService,
    {
      provide: QR_CODE_SERVICE,
      useClass: QrCodeService,
    },
    PdfWatermarkService,
    {
      provide: PDF_WATERMARK_SERVICE,
      useClass: PdfWatermarkService,
    },
    WatermarkQueueService,
    {
      provide: WATERMARK_QUEUE_SERVICE,
      useClass: WatermarkQueueService,
    },
    WatermarkProcessor,
  ],
  exports: [
    QrCodeService,
    QR_CODE_SERVICE,
    PdfWatermarkService,
    PDF_WATERMARK_SERVICE,
    WatermarkQueueService,
    WATERMARK_QUEUE_SERVICE,
    WatermarkProcessor,
  ],
})
export class WatermarkModule {}
