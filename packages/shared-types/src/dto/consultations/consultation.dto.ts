import {
  AnimalSpecies,
  ConsultationNotificationChannel,
  ConsultationNotificationStatus,
  ConsultationPaymentStatus,
  ConsultationStatus,
  ConsultationType,
} from "../../enums/index.js";

export interface CreateConsultationRequestDto {
  farmId: string;
  animalId?: string;
  chiefComplaint: string;
  mediaUrls?: string[];
  type?: ConsultationType;
  currency?: string;
}

export interface ConsultationResponseDto {
  id: string;
  farmerId: string;
  vetId: string | null;
  farmId: string;
  animalId: string | null;
  chiefComplaint: string;
  mediaUrls: string[];
  type: ConsultationType;
  status: ConsultationStatus;
  roomSessionId: string | null;
  feeCents: number;
  scheduledAt?: string | null;
  assignedAt?: string | null;
  paymentStatus: ConsultationPaymentStatus;
  paymentIntentId?: string | null;
  paymentHeldAt?: string | null;
  paymentCapturedAt?: string | null;
  paymentReleasedAt?: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  farmer?: { id: string; name: string; email: string } | null;
  vet?: { id: string; name: string; email: string } | null;
  animal?: { id: string; name: string; tagNumber: string; species: string } | null;
  farm?: { id: string; name: string } | null;
}

export interface QueryFarmerConsultationsDto {
  page?: number;
  limit?: number;
  status?: ConsultationStatus;
  animalId?: string;
  type?: ConsultationType;
}

export interface TriageQueueItemDto {
  id: string;
  farmerId: string;
  vetId: string | null;
  farmId: string;
  animalId: string | null;
  chiefComplaint: string;
  mediaUrls: string[];
  type: ConsultationType;
  status: ConsultationStatus;
  feeCents: number;
  scheduledAt?: string | null;
  assignedAt?: string | null;
  paymentStatus: ConsultationPaymentStatus;
  paymentIntentId?: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  waitTimeMinutes: number;
  farmer?: { id: string; name: string; email: string } | null;
  vet?: { id: string; name: string; email: string } | null;
  animal?: { id: string; name: string; tagNumber: string; species: string } | null;
  farm?: { id: string; name: string } | null;
}

export interface TriageMetricsDto {
  pendingCount: number;
  assignedCount: number;
  inProgressCount: number;
  completedTodayCount: number;
  cancelledTodayCount: number;
  typeBreakdown: {
    asyncTickets: number;
    liveVideos: number;
  };
  speciesBreakdown: Record<string, number>;
  avgWaitTimeMinutes: number;
  oldestPendingWaitMinutes: number;
}

export interface TriageRecentHealthRecordDto {
  id: string;
  eventType: string;
  severity: string;
  symptoms: string;
  diagnosis?: string | null;
  treatment?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface TriageRecentVaccineRecordDto {
  id: string;
  type: string;
  vaccineName: string;
  administeredDate: string;
  dosage?: string | null;
}

export interface TriageCaseDetailDto extends TriageQueueItemDto {
  farmerPhone?: string | null;
  farmType?: string | null;
  animalDetails?: {
    id: string;
    name: string | null;
    tagNumber: string;
    rfidNumber: string | null;
    species: string;
    breed: string | null;
    gender: string;
    dateOfBirth: string | null;
    weightKg: number | null;
    status: string;
  } | null;
  recentHealthRecords: TriageRecentHealthRecordDto[];
  recentVaccineRecords: TriageRecentVaccineRecordDto[];
}

export interface QueryTriageQueueDto {
  page?: number;
  limit?: number;
  status?: ConsultationStatus | "ALL";
  type?: ConsultationType;
  species?: AnimalSpecies;
  farmId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "status";
  sortOrder?: "asc" | "desc";
}

export interface CancelTriageCaseDto {
  reason: string;
}

export interface VetWorkingHoursDto {
  dayOfWeek: number; // 1 = Monday, 7 = Sunday
  startTime: string; // "08:00"
  endTime: string;   // "17:00"
}

export interface VetProfileDto {
  id: string;
  userId: string;
  specialties: string[];
  isAvailable: boolean;
  maxActiveCases: number;
  workingHours: VetWorkingHoursDto[];
  timezone: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
}

export interface UpdateVetProfileDto {
  specialties?: string[];
  isAvailable?: boolean;
  maxActiveCases?: number;
  workingHours?: VetWorkingHoursDto[];
  timezone?: string;
}

export interface VetCandidateScoreBreakdownDto {
  specialtyScore: number;
  workloadScore: number;
  availabilityScore: number;
}

export interface VetCandidateDto {
  vetId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  specialties: string[];
  isAvailable: boolean;
  currentActiveCases: number;
  maxActiveCases: number;
  totalScore: number;
  scoreBreakdown: VetCandidateScoreBreakdownDto;
  isEligible: boolean;
  ineligibilityReason?: string;
}

export interface AssignConsultationDto {
  vetId: string;
  scheduledAt?: string;
  notes?: string;
}

export interface AutoAssignConsultationDto {
  scheduledAt?: string;
}

export interface VetAvailabilitySummaryDto {
  vetId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isAvailable: boolean;
  specialties: string[];
  currentActiveCases: number;
  maxActiveCases: number;
  capacityUtilizationPercent: number;
  timezone: string;
}

export interface ConsultationPaymentHoldResultDto {
  consultationId: string;
  paymentIntentId: string;
  clientSecret?: string;
  amountCents: number;
  currency: string;
  paymentStatus: ConsultationPaymentStatus;
}

export interface ConfirmPaymentHoldDto {
  paymentIntentId: string;
}

export interface CaptureConsultationPaymentResultDto {
  consultationId: string;
  paymentIntentId: string;
  amountCents: number;
  paymentStatus: ConsultationPaymentStatus;
  capturedAt: string;
}

export interface ReleaseConsultationHoldResultDto {
  consultationId: string;
  paymentIntentId: string;
  paymentStatus: ConsultationPaymentStatus;
  releasedAt: string;
  reason?: string;
}

export interface ConsultationNotificationLogDto {
  id: string;
  consultationId: string;
  vetId: string;
  channel: ConsultationNotificationChannel;
  status: ConsultationNotificationStatus;
  title: string;
  message: string;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  readAt?: string | null;
  dispatchedAt: string;
}

export interface NotifyVetDto {
  channels?: ConsultationNotificationChannel[];
  customNote?: string;
}

export interface ChannelDeliveryResultDto {
  channel: ConsultationNotificationChannel;
  status: ConsultationNotificationStatus;
  messageId?: string;
  error?: string;
}

export interface ConsultationNotificationResultDto {
  consultationId: string;
  vetId: string;
  channels: ChannelDeliveryResultDto[];
  dispatchedAt: string;
}

export interface QueryVetNotificationsDto {
  page?: number;
  limit?: number;
  channel?: ConsultationNotificationChannel;
  unreadOnly?: boolean;
}

export interface PaginatedVetNotificationsDto {
  items: ConsultationNotificationLogDto[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
}
