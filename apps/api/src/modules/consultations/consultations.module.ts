import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../config";
import { CryptoModule } from "../../common/crypto/crypto.module";
import { AuditModule } from "../audit";
import {
  MockPushNotificationProvider,
  MockSmsNotificationProvider,
} from "../clinical-health/providers/mock-notification.provider";
import {
  PUSH_NOTIFICATION_PROVIDER,
  SMS_NOTIFICATION_PROVIDER,
} from "../clinical-health/providers/notification-provider.interface";
import { FarmsModule } from "../farms";
import { MailModule } from "../mail/mail.module";
import { PrismaModule } from "../prisma";
import { SubscriptionsModule } from "../subscriptions";
import { ConsultationNotificationController } from "./controllers/consultation-notification.controller";
import { ConsultationPaymentController } from "./controllers/consultation-payment.controller";
import { ConsultationTriageController } from "./controllers/consultation-triage.controller";
import { VetAvailabilityController } from "./controllers/vet-availability.controller";
import { AnimalEhrController } from "./controllers/animal-ehr.controller";
import { VideoRoomController } from "./controllers/video-room.controller";
import { ConsultationChatController } from "./controllers/consultation-chat.controller";
import { ConsultationClinicalNotesController } from "./controllers/consultation-clinical-notes.controller";
import { PrescriptionsController } from "./controllers/prescriptions.controller";
import { PrescriptionVerificationController } from "./controllers/prescription-verification.controller";
import { FoodSafetyController } from "./controllers/food-safety.controller";
import { ConsultationSettlementController } from "./controllers/consultation-settlement.controller";
import { ConsultationReviewController } from "./controllers/consultation-review.controller";
import { ConsultationController } from "./consultation.controller";
import { ConsultationNotificationLogRepository } from "./repositories/consultation-notification-log.repository";
import { CONSULTATION_NOTIFICATION_LOG_REPOSITORY } from "./repositories/consultation-notification-log.repository.interface";
import { ConsultationReviewRepository } from "./repositories/consultation-review.repository";
import { CONSULTATION_REVIEW_REPOSITORY } from "./repositories/consultation-review.repository.interface";
import { ConsultationRepository } from "./repositories/consultation.repository";
import { CONSULTATION_REPOSITORY } from "./repositories/consultation.repository.interface";
import { PayoutLedgerRepository } from "./repositories/payout-ledger.repository";
import { PAYOUT_LEDGER_REPOSITORY } from "./repositories/payout-ledger.repository.interface";
import { ConsultationMessageRepository } from "./repositories/consultation-message.repository";
import { CONSULTATION_MESSAGE_REPOSITORY } from "./repositories/consultation-message.repository.interface";
import { ConsultationClinicalNoteRepository } from "./repositories/consultation-clinical-note.repository";
import { CONSULTATION_CLINICAL_NOTE_REPOSITORY } from "./repositories/consultation-clinical-note.repository.interface";
import { PrescriptionRepository } from "./repositories/prescription.repository";
import { PRESCRIPTION_REPOSITORY } from "./repositories/prescription.repository.interface";
import { VetProfileRepository } from "./repositories/vet-profile.repository";
import { VET_PROFILE_REPOSITORY } from "./repositories/vet-profile.repository.interface";
import { AnimalEhrService } from "./services/animal-ehr.service";
import { ANIMAL_EHR_SERVICE } from "./services/animal-ehr.service.interface";
import { ConsultationNotificationService } from "./services/consultation-notification.service";
import { CONSULTATION_NOTIFICATION_SERVICE } from "./services/consultation-notification.service.interface";
import { ConsultationPaymentService } from "./services/consultation-payment.service";
import { CONSULTATION_PAYMENT_SERVICE } from "./services/consultation-payment.service.interface";
import { ConsultationStripePaymentGateway } from "./services/consultation-stripe-payment.service";
import { CONSULTATION_PAYMENT_GATEWAY } from "./services/consultation-payment-gateway.interface";
import { ConsultationService } from "./services/consultation.service";
import { CONSULTATION_SERVICE } from "./services/consultation.service.interface";
import { PrescriptionService } from "./services/prescription.service";
import { PRESCRIPTION_SERVICE } from "./services/prescription.service.interface";
import { FoodSafetyService } from "./services/food-safety.service";
import { FOOD_SAFETY_SERVICE } from "./services/food-safety.service.interface";
import { PrescriptionPdfService } from "./services/prescription-pdf.service";
import { PRESCRIPTION_PDF_SERVICE } from "./services/prescription-pdf.service.interface";
import { VetPayoutLedgerService } from "./services/vet-payout-ledger.service";
import { VET_PAYOUT_LEDGER_SERVICE } from "./services/vet-payout-ledger.service.interface";
import { ConsultationReviewService } from "./services/consultation-review.service";
import { CONSULTATION_REVIEW_SERVICE } from "./services/consultation-review.service.interface";
import { VetAssignmentService } from "./services/vet-assignment.service";
import { VET_ASSIGNMENT_SERVICE } from "./services/vet-assignment.service.interface";
import { DailyVideoRoomProvider } from "./providers/daily-video-room.provider";
import { VIDEO_ROOM_PROVIDER } from "./providers/video-room-provider.interface";
import { VideoRoomService } from "./services/video-room.service";
import { VIDEO_ROOM_SERVICE } from "./services/video-room.service.interface";
import { ConsultationChatService } from "./services/consultation-chat.service";
import { CONSULTATION_CHAT_SERVICE } from "./services/consultation-chat.service.interface";
import { ConsultationClinicalNoteService } from "./services/consultation-clinical-note.service";
import { CONSULTATION_CLINICAL_NOTE_SERVICE } from "./services/consultation-clinical-note.service.interface";
import { ConsultationChatGateway } from "./gateways/consultation-chat.gateway";
import { AuthModule } from "../auth";
import { MediaModule } from "../media/media.module";

@Module({
  imports: [
    AppConfigModule,
    CryptoModule,
    PrismaModule,
    AuditModule,
    FarmsModule,
    SubscriptionsModule,
    MailModule,
    AuthModule,
    MediaModule,
  ],
  controllers: [
    ConsultationController,
    ConsultationTriageController,
    VetAvailabilityController,
    ConsultationPaymentController,
    ConsultationNotificationController,
    AnimalEhrController,
    VideoRoomController,
    ConsultationChatController,
    ConsultationClinicalNotesController,
    PrescriptionsController,
    PrescriptionVerificationController,
    FoodSafetyController,
    ConsultationSettlementController,
    ConsultationReviewController,
  ],
  providers: [
    ConsultationRepository,
    {
      provide: CONSULTATION_REPOSITORY,
      useClass: ConsultationRepository,
    },
    VetProfileRepository,
    {
      provide: VET_PROFILE_REPOSITORY,
      useClass: VetProfileRepository,
    },
    ConsultationNotificationLogRepository,
    {
      provide: CONSULTATION_NOTIFICATION_LOG_REPOSITORY,
      useClass: ConsultationNotificationLogRepository,
    },
    ConsultationStripePaymentGateway,
    {
      provide: CONSULTATION_PAYMENT_GATEWAY,
      useClass: ConsultationStripePaymentGateway,
    },
    ConsultationPaymentService,
    {
      provide: CONSULTATION_PAYMENT_SERVICE,
      useClass: ConsultationPaymentService,
    },
    ConsultationService,
    {
      provide: CONSULTATION_SERVICE,
      useClass: ConsultationService,
    },
    VetAssignmentService,
    {
      provide: VET_ASSIGNMENT_SERVICE,
      useClass: VetAssignmentService,
    },
    MockPushNotificationProvider,
    {
      provide: PUSH_NOTIFICATION_PROVIDER,
      useClass: MockPushNotificationProvider,
    },
    MockSmsNotificationProvider,
    {
      provide: SMS_NOTIFICATION_PROVIDER,
      useClass: MockSmsNotificationProvider,
    },
    ConsultationNotificationService,
    {
      provide: CONSULTATION_NOTIFICATION_SERVICE,
      useClass: ConsultationNotificationService,
    },
    AnimalEhrService,
    {
      provide: ANIMAL_EHR_SERVICE,
      useClass: AnimalEhrService,
    },
    DailyVideoRoomProvider,
    {
      provide: VIDEO_ROOM_PROVIDER,
      useClass: DailyVideoRoomProvider,
    },
    VideoRoomService,
    {
      provide: VIDEO_ROOM_SERVICE,
      useClass: VideoRoomService,
    },
    ConsultationMessageRepository,
    {
      provide: CONSULTATION_MESSAGE_REPOSITORY,
      useClass: ConsultationMessageRepository,
    },
    ConsultationChatService,
    {
      provide: CONSULTATION_CHAT_SERVICE,
      useClass: ConsultationChatService,
    },
    ConsultationChatGateway,
    ConsultationClinicalNoteRepository,
    {
      provide: CONSULTATION_CLINICAL_NOTE_REPOSITORY,
      useClass: ConsultationClinicalNoteRepository,
    },
    ConsultationClinicalNoteService,
    {
      provide: CONSULTATION_CLINICAL_NOTE_SERVICE,
      useClass: ConsultationClinicalNoteService,
    },
    PrescriptionRepository,
    {
      provide: PRESCRIPTION_REPOSITORY,
      useClass: PrescriptionRepository,
    },
    PrescriptionService,
    {
      provide: PRESCRIPTION_SERVICE,
      useClass: PrescriptionService,
    },
    PrescriptionPdfService,
    {
      provide: PRESCRIPTION_PDF_SERVICE,
      useClass: PrescriptionPdfService,
    },
    FoodSafetyService,
    {
      provide: FOOD_SAFETY_SERVICE,
      useClass: FoodSafetyService,
    },
    PayoutLedgerRepository,
    {
      provide: PAYOUT_LEDGER_REPOSITORY,
      useClass: PayoutLedgerRepository,
    },
    VetPayoutLedgerService,
    {
      provide: VET_PAYOUT_LEDGER_SERVICE,
      useClass: VetPayoutLedgerService,
    },
    ConsultationReviewRepository,
    {
      provide: CONSULTATION_REVIEW_REPOSITORY,
      useClass: ConsultationReviewRepository,
    },
    ConsultationReviewService,
    {
      provide: CONSULTATION_REVIEW_SERVICE,
      useClass: ConsultationReviewService,
    },
  ],
  exports: [
    ConsultationRepository,
    CONSULTATION_REPOSITORY,
    VetProfileRepository,
    VET_PROFILE_REPOSITORY,
    ConsultationNotificationLogRepository,
    CONSULTATION_NOTIFICATION_LOG_REPOSITORY,
    ConsultationStripePaymentGateway,
    CONSULTATION_PAYMENT_GATEWAY,
    ConsultationPaymentService,
    CONSULTATION_PAYMENT_SERVICE,
    ConsultationService,
    CONSULTATION_SERVICE,
    VetAssignmentService,
    VET_ASSIGNMENT_SERVICE,
    ConsultationNotificationService,
    CONSULTATION_NOTIFICATION_SERVICE,
    AnimalEhrService,
    ANIMAL_EHR_SERVICE,
    DailyVideoRoomProvider,
    VIDEO_ROOM_PROVIDER,
    VideoRoomService,
    VIDEO_ROOM_SERVICE,
    ConsultationMessageRepository,
    CONSULTATION_MESSAGE_REPOSITORY,
    ConsultationChatService,
    CONSULTATION_CHAT_SERVICE,
    ConsultationChatGateway,
    ConsultationClinicalNoteRepository,
    CONSULTATION_CLINICAL_NOTE_REPOSITORY,
    ConsultationClinicalNoteService,
    CONSULTATION_CLINICAL_NOTE_SERVICE,
    PrescriptionRepository,
    PRESCRIPTION_REPOSITORY,
    PrescriptionService,
    PRESCRIPTION_SERVICE,
    PrescriptionPdfService,
    PRESCRIPTION_PDF_SERVICE,
    FoodSafetyService,
    FOOD_SAFETY_SERVICE,
    PayoutLedgerRepository,
    PAYOUT_LEDGER_REPOSITORY,
    VetPayoutLedgerService,
    VET_PAYOUT_LEDGER_SERVICE,
    ConsultationReviewRepository,
    CONSULTATION_REVIEW_REPOSITORY,
    ConsultationReviewService,
    CONSULTATION_REVIEW_SERVICE,
  ],
})
export class ConsultationsModule {}
