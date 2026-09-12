export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  VET = "VET",
  FARMER = "FARMER",
  BUYER = "BUYER",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
}

export enum FarmType {
  DAIRY = "DAIRY",
  BEEF = "BEEF",
  POULTRY = "POULTRY",
  GOAT_SHEEP = "GOAT_SHEEP",
  MIXED = "MIXED",
}

export enum FarmRole {
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  HERDSMAN = "HERDSMAN",
  VET_STAFF = "VET_STAFF",
}

export enum AnimalSpecies {
  COW = "COW",
  BUFFALO = "BUFFALO",
  GOAT = "GOAT",
  SHEEP = "SHEEP",
  CAMEL = "CAMEL",
  POULTRY = "POULTRY",
  OTHER = "OTHER",
}

export enum AnimalGender {
  MALE = "MALE",
  FEMALE = "FEMALE",
}

export enum AnimalStatus {
  ACTIVE = "ACTIVE",
  QUARANTINE = "QUARANTINE",
  SOLD = "SOLD",
  DECEASED = "DECEASED",
  CULLED = "CULLED",
}

export enum HealthEventType {
  ILLNESS = "ILLNESS",
  INJURY = "INJURY",
  SURGERY = "SURGERY",
  ROUTINE_CHECK = "ROUTINE_CHECK",
  BREEDING_EXAM = "BREEDING_EXAM",
}

export enum SeverityLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum MilkSession {
  MORNING = "MORNING",
  AFTERNOON = "AFTERNOON",
  EVENING = "EVENING",
}

export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

export enum TransactionCategory {
  FEED = "FEED",
  MEDICINE = "MEDICINE",
  LABOR = "LABOR",
  EQUIPMENT = "EQUIPMENT",
  MILK_SALES = "MILK_SALES",
  LIVESTOCK_SALES = "LIVESTOCK_SALES",
  OTHER = "OTHER",
}

export enum ProductType {
  VIDEO_COURSE = "VIDEO_COURSE",
  EBOOK = "EBOOK",
  EXCEL_TOOL = "EXCEL_TOOL",
}

export enum SubscriptionTier {
  STARTER = "STARTER",
  PRO = "PRO",
  ENTERPRISE = "ENTERPRISE",
}

export enum OrderStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export enum SubscriptionStatus {
  TRIALING = "TRIALING",
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELED = "CANCELED",
  EXPIRED = "EXPIRED",
}

export enum ConsultationType {
  ASYNC_TICKET = "ASYNC_TICKET",
  LIVE_VIDEO = "LIVE_VIDEO",
}

export enum ConsultationStatus {
  SUBMITTED = "SUBMITTED",
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum InbreedingRiskLevel {
  LOW = "LOW",
  MODERATE = "MODERATE",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum GrowthTrajectory {
  ACCELERATING = "ACCELERATING",
  STEADY = "STEADY",
  SLOWING = "SLOWING",
  WEIGHT_LOSS = "WEIGHT_LOSS",
}

export enum ImportJobStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  PARTIALLY_COMPLETED = "PARTIALLY_COMPLETED",
  FAILED = "FAILED",
}

export enum TagBadgeLayout {
  GRID_2X3 = "GRID_2X3",
  GRID_2X4 = "GRID_2X4",
  SINGLE_PER_PAGE = "SINGLE_PER_PAGE",
}

export enum TagBadgePageSize {
  A4 = "A4",
  LETTER = "LETTER",
}
