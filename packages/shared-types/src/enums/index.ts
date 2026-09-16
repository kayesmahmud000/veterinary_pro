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
  UTILITY = "UTILITY",
  MILK_SALES = "MILK_SALES",
  LIVESTOCK_SALES = "LIVESTOCK_SALES",
  MANURE = "MANURE",
  BYPRODUCTS = "BYPRODUCTS",
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

export enum SubscriptionQuotaType {
  ANIMALS = "ANIMALS",
  STAFF = "STAFF",
}

export enum SubscriptionBillingInterval {
  MONTHLY = "MONTHLY",
  ANNUAL = "ANNUAL",
}

export enum SubscriptionPlanChangeType {
  UPGRADE = "UPGRADE",
  DOWNGRADE = "DOWNGRADE",
  INTERVAL_CHANGE = "INTERVAL_CHANGE",
  NO_CHANGE = "NO_CHANGE",
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

export * from "./milk-anomaly-severity.enum.js";
export * from "./milk-anomaly-status.enum.js";
export * from "./milk-export-format.enum.js";
export * from "./vaccine-record-type.enum.js";
export * from "./preventative-schedule-status.enum.js";
export * from "./reminder-channel.enum.js";
export * from "./reminder-milestone.enum.js";
export * from "./reminder-status.enum.js";
export * from "./health-escalation-level.enum.js";
export * from "./health-escalation-action.enum.js";
export * from "./health-attachment-status.enum.js";

export enum ProfitLossInterval {
  DAY = "DAY",
  WEEK = "WEEK",
  MONTH = "MONTH",
  YEAR = "YEAR",
}

export enum FeedEfficiencyRating {
  EXCELLENT = "EXCELLENT",
  GOOD = "GOOD",
  AVERAGE = "AVERAGE",
  POOR = "POOR",
  CRITICAL = "CRITICAL",
}
