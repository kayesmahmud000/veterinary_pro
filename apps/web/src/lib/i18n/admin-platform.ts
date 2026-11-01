import type { Locale } from "./locale";
const en = {
  settings: "Report settings",
  integrations: "Integration status",
  system: "System status",
  metrics: "Platform metrics",
  reports: "Reports and exports",
  settingsNote:
    "Set the organization name and optional contact email shown on reports and JSON exports. The timezone is the default for new reports.",
  fallback:
    "This provider can return simulated results. A successful application response alone does not prove a real provider operation.",
  organizationBn: "Organization name · Bangla",
  organizationEn: "Organization name · English",
  supportEmail: "Report contact email",
  reportTimezone: "Default report timezone",
  version: "Version",
  save: "Save settings",
  saved: "Saved. The current record is shown below.",
  refresh: "Reload current record",
  loading: "Loading…",
  empty: "No records for this selection.",
  reason: "Reason (10–500 characters)",
  password: "Your password",
  confirm: "Review and confirm",
  pending: "Processing…",
  download: "Download JSON",
  recorded: "Diagnostic snapshot recorded",
  snapshot: "Snapshot time",
  generated: "Generated at",
  integrationNote:
    "These statuses describe provider bindings and configuration presence. Configured providers have not been tested here. External provider tests are unavailable on this screen.",
  systemNote:
    "Read-only dependency observations. Registered workers may be inactive; registration does not prove processing or delivery. Role email uses a separate durable outbox.",
  diagnosticNote:
    "Record a fresh dependency snapshot with an audit entry. Checks read database, Redis and queue metadata. They do not dispatch messages or process jobs.",
  run: "Record diagnostics",
  database: "Database and outbox",
  redis: "Redis",
  workers: "Registered workers",
  queues: "Queue observations",
  roleEmail: "Role email outbox",
  waiting: "Waiting",
  active: "Active",
  delayed: "Delayed",
  failed: "Failed",
  completed: "Completed",
  pendingEmail: "Pending outbox records",
  failedEmail: "Failed recipient deliveries",
  reportNote:
    "Snapshot counts and estimated MRR show current stored state. The date range selects creation cohorts and order records; it does not reconstruct historical subscription status.",
  rangeNote:
    "Start is inclusive; end is exclusive at midnight in the selected timezone. Choose 1–366 days. Order amounts describe current status of orders created in this range, rather than cash receipts.",
  mrrNote:
    "Estimated MRR uses current local USD plan prices and stored ACTIVE status. Periods longer than 60 days use the annual price divided by 12, rounded per subscription. This is not invoiced revenue. Provider invoice amounts and historical MRR/churn are unavailable.",
  from: "Start date (included)",
  to: "End date (excluded)",
  timezone: "Reporting timezone",
  apply: "Apply dates",
  dateRequired: "Enter a date.",
  dateCalendar: "Enter a valid calendar date on or after 1 January 2000.",
  dateOrder: "End date must be after start date.",
  dateLength: "Choose a range of at most 366 days.",
  dateFuture:
    "End date cannot be later than tomorrow in the selected timezone.",
  dateTimezone: "Choose UTC or Asia/Dhaka.",
  dateValidation: "Check the highlighted dates and timezone.",
  dateRejected:
    "The date range could not be accepted. Review the dates and timezone, then apply again.",
  unappliedDates:
    "These filter changes are not applied. The report still shows the applied range; apply valid dates to update it.",
  range: "Resolved date range",
  totals: "Current platform totals",
  accounts: "Accounts",
  farms: "Farms",
  pendingRoleRequests: "Pending role applications",
  subscriptions: "Current subscription status",
  tiers: "Current subscriptions by tier",
  estimatedMrr: "Estimated monthly recurring amount · USD",
  created: "Subscriptions created by month",
  orders: "Orders by currency and current status",
  orderMonths: "Orders created by month",
  support: "Current support queue",
  consultations: "Current consultation status",
  count: "Count",
  amount: "Amount",
  period: "Local calendar month",
  currency: "Currency",
  status: "Status",
  exportReport: "Prepare report export",
  exportAudit: "Prepare audit export",
  exportNote:
    "Exports contain private administrative data. JSON preserves exact minor-unit amounts. Each preparation requires confirmation and records an audit event. Audit exports contain metadata only, filtered by your permissions.",
  audit: "Audit export filters",
  actorId: "Actor UUID (optional)",
  entityId: "Entity UUID (optional)",
  action: "Exact action (optional)",
  entityType: "Entity type (optional)",
  limit: "Maximum audit rows (1–500)",
  cursor: "After audit UUID (optional)",
  truncated:
    "More audit records exist. Copy the continuation UUID into the filter and prepare another export.",
  continuation: "Continuation UUID",
  rows: "Exported rows",
  error:
    "Unable to complete this request. Your inputs are retained. Reload and review the current record before trying again.",
  validation:
    "Check the dates, field limits, password and reason. Start must precede end; select at most 366 days.",
  passwordError:
    "Password confirmation failed. Check your password and try again.",
  conflict:
    "The record changed or the previous outcome is uncertain. Reload the current record and review before trying again.",
  denied: "Your current account cannot perform this action.",
  limited: "Too many requests. Wait before trying again.",
};
const bn: typeof en = {
  settings: "প্রতিবেদনের সেটিংস",
  integrations: "ইন্টিগ্রেশনের অবস্থা",
  system: "সিস্টেমের অবস্থা",
  metrics: "প্ল্যাটফর্মের পরিসংখ্যান",
  reports: "প্রতিবেদন ও এক্সপোর্ট",
  settingsNote:
    "প্রতিবেদন ও JSON এক্সপোর্টে দেখানোর প্রতিষ্ঠানের নাম ও ঐচ্ছিক যোগাযোগ ইমেইল নির্ধারণ করুন। নতুন প্রতিবেদনে এই সময় অঞ্চল ব্যবহার হবে।",
  fallback:
    "এই প্রোভাইডার অনুকরণ করা ফল দিতে পারে। অ্যাপ্লিকেশনের সফল ফল একা প্রকৃত প্রোভাইডারের কাজের প্রমাণ নয়।",
  organizationBn: "প্রতিষ্ঠানের নাম · বাংলা",
  organizationEn: "প্রতিষ্ঠানের নাম · ইংরেজি",
  supportEmail: "প্রতিবেদনের যোগাযোগ ইমেইল",
  reportTimezone: "প্রতিবেদনের প্রাথমিক সময় অঞ্চল",
  version: "সংস্করণ",
  save: "সেটিংস সংরক্ষণ",
  saved: "সংরক্ষিত হয়েছে। নিচে বর্তমান রেকর্ড দেখানো হচ্ছে।",
  refresh: "বর্তমান রেকর্ড আবার লোড করুন",
  loading: "লোড হচ্ছে…",
  empty: "এই নির্বাচনে কোনো রেকর্ড নেই।",
  reason: "কারণ (১০–৫০০ অক্ষর)",
  password: "আপনার পাসওয়ার্ড",
  confirm: "পর্যালোচনা করে নিশ্চিত করুন",
  pending: "প্রক্রিয়াধীন…",
  download: "JSON ডাউনলোড",
  recorded: "পরীক্ষার স্ন্যাপশট সংরক্ষিত হয়েছে",
  snapshot: "স্ন্যাপশটের সময়",
  generated: "তৈরির সময়",
  integrationNote:
    "এখানে ব্যবহৃত প্রোভাইডার ও কনফিগারেশন থাকার অবস্থা দেখানো হয়। কনফিগার করা প্রোভাইডার এখানে পরীক্ষা করা হয়নি। এই পর্দায় বাইরের প্রোভাইডার পরীক্ষা উপলব্ধ নেই।",
  systemNote:
    "এগুলো কেবল নির্ভরশীল সেবার পর্যবেক্ষণ। নিবন্ধিত ওয়ার্কার নিষ্ক্রিয় থাকতে পারে; নিবন্ধন প্রক্রিয়াকরণ বা ডেলিভারির প্রমাণ নয়। রোল ইমেইলের জন্য আলাদা স্থায়ী আউটবক্স ব্যবহৃত হয়।",
  diagnosticNote:
    "নতুন পরীক্ষার ফল ও অডিট রেকর্ড সংরক্ষণ করুন। পরীক্ষা শুধু ডেটাবেস, Redis ও কিউয়ের তথ্য পড়ে। কোনো বার্তা পাঠায় বা কাজ প্রক্রিয়া করে না।",
  run: "পরীক্ষার ফল সংরক্ষণ",
  database: "ডেটাবেস ও আউটবক্স",
  redis: "Redis",
  workers: "নিবন্ধিত ওয়ার্কার",
  queues: "কিউ পর্যবেক্ষণ",
  roleEmail: "রোল ইমেইল আউটবক্স",
  waiting: "অপেক্ষমাণ",
  active: "সক্রিয়",
  delayed: "বিলম্বিত",
  failed: "ব্যর্থ",
  completed: "সম্পন্ন",
  pendingEmail: "অপেক্ষমাণ আউটবক্স রেকর্ড",
  failedEmail: "প্রাপকের ব্যর্থ ডেলিভারি",
  reportNote:
    "স্ন্যাপশটের সংখ্যা ও আনুমানিক MRR বর্তমান সংরক্ষিত অবস্থা দেখায়। তারিখের সীমা তৈরি হওয়া সাবস্ক্রিপশন ও অর্ডার বেছে নেয়; অতীতের সাবস্ক্রিপশন অবস্থা পুনর্গঠন করে না।",
  rangeNote:
    "নির্বাচিত সময় অঞ্চলে শুরুর তারিখের মধ্যরাত অন্তর্ভুক্ত, শেষের মধ্যরাত বাদ। ১–৩৬৬ দিন বেছে নিন। অর্ডারের অর্থ এই সময়ে তৈরি অর্ডারের বর্তমান অবস্থা; নগদ আদায় নয়।",
  mrrNote:
    "আনুমানিক MRR বর্তমান স্থানীয় USD প্ল্যানের মূল্য ও সংরক্ষিত সক্রিয় অবস্থা ব্যবহার করে। ৬০ দিনের বেশি মেয়াদে বার্ষিক মূল্যকে ১২ দিয়ে ভাগ করে প্রতি সাবস্ক্রিপশনে পূর্ণ সংখ্যায় করা হয়। এটি ইনভয়েসের আয় নয়। প্রোভাইডারের ইনভয়েস ও অতীতের MRR বা গ্রাহক হারানোর হিসাব উপলব্ধ নেই।",
  from: "শুরুর তারিখ (অন্তর্ভুক্ত)",
  to: "শেষের তারিখ (বাদ)",
  timezone: "প্রতিবেদনের সময় অঞ্চল",
  apply: "তারিখ প্রয়োগ",
  dateRequired: "একটি তারিখ দিন।",
  dateCalendar: "১ জানুয়ারি ২০০০ বা তার পরের একটি সঠিক পঞ্জিকার তারিখ দিন।",
  dateOrder: "শেষের তারিখ শুরুর তারিখের পরে হতে হবে।",
  dateLength: "সর্বোচ্চ ৩৬৬ দিনের সীমা বেছে নিন।",
  dateFuture: "নির্বাচিত সময় অঞ্চলে শেষের তারিখ আগামীকালের পরে হতে পারবে না।",
  dateTimezone: "UTC বা Asia/Dhaka বেছে নিন।",
  dateValidation: "চিহ্নিত তারিখ ও সময় অঞ্চল ঠিক করুন।",
  dateRejected:
    "তারিখের সীমা গ্রহণ করা যায়নি। তারিখ ও সময় অঞ্চল পরীক্ষা করে আবার প্রয়োগ করুন।",
  unappliedDates:
    "ফিল্টারের এই পরিবর্তন এখনো প্রয়োগ হয়নি। প্রতিবেদনে আগের প্রয়োগ করা সীমার ফল রয়েছে; হালনাগাদ করতে সঠিক তারিখ প্রয়োগ করুন।",
  range: "নির্ধারিত তারিখের সীমা",
  totals: "প্ল্যাটফর্মের বর্তমান মোট",
  accounts: "অ্যাকাউন্ট",
  farms: "খামার",
  pendingRoleRequests: "অপেক্ষমাণ রোল আবেদন",
  subscriptions: "সাবস্ক্রিপশনের বর্তমান অবস্থা",
  tiers: "প্ল্যান অনুযায়ী বর্তমান সাবস্ক্রিপশন",
  estimatedMrr: "আনুমানিক মাসিক পুনরাবৃত্ত অর্থ · USD",
  created: "মাস অনুযায়ী তৈরি সাবস্ক্রিপশন",
  orders: "মুদ্রা ও বর্তমান অবস্থা অনুযায়ী অর্ডার",
  orderMonths: "মাস অনুযায়ী তৈরি অর্ডার",
  support: "বর্তমান সহায়তার কিউ",
  consultations: "পরামর্শের বর্তমান অবস্থা",
  count: "সংখ্যা",
  amount: "অর্থ",
  period: "স্থানীয় পঞ্জিকার মাস",
  currency: "মুদ্রা",
  status: "অবস্থা",
  exportReport: "প্রতিবেদন এক্সপোর্ট তৈরি",
  exportAudit: "অডিট এক্সপোর্ট তৈরি",
  exportNote:
    "এক্সপোর্টে ব্যক্তিগত প্রশাসনিক তথ্য থাকে। JSON সঠিক ক্ষুদ্র এককের অর্থ অক্ষুণ্ণ রাখে। প্রতিবার তৈরি করতে নিশ্চিতকরণ লাগে এবং অডিট রেকর্ড হয়। অডিট এক্সপোর্টে আপনার অনুমতি অনুযায়ী শুধু রেকর্ডের পরিচিতি থাকে।",
  audit: "অডিট এক্সপোর্টের ফিল্টার",
  actorId: "কর্মকর্তার UUID (ঐচ্ছিক)",
  entityId: "বিষয়ের UUID (ঐচ্ছিক)",
  action: "হুবহু কাজের নাম (ঐচ্ছিক)",
  entityType: "বিষয়ের ধরন (ঐচ্ছিক)",
  limit: "অডিট রেকর্ডের সর্বোচ্চ সংখ্যা (১–৫০০)",
  cursor: "এই অডিট UUID-এর পর থেকে (ঐচ্ছিক)",
  truncated:
    "আরও অডিট রেকর্ড আছে। পরবর্তী UUID ফিল্টারে বসিয়ে আরেকটি এক্সপোর্ট তৈরি করুন।",
  continuation: "পরবর্তী UUID",
  rows: "এক্সপোর্ট করা রেকর্ড",
  error:
    "অনুরোধ সম্পন্ন হয়নি। আপনার লেখা রাখা হয়েছে। আবার চেষ্টা করার আগে বর্তমান রেকর্ড লোড করে পর্যালোচনা করুন।",
  validation:
    "তারিখ, অক্ষরসীমা, পাসওয়ার্ড ও কারণ যাচাই করুন। শুরুর তারিখ শেষের আগে হতে হবে; সর্বোচ্চ ৩৬৬ দিন বেছে নিন।",
  passwordError: "পাসওয়ার্ড মেলেনি। যাচাই করে আবার চেষ্টা করুন।",
  conflict:
    "রেকর্ড বদলেছে অথবা আগের অনুরোধের ফল অনিশ্চিত। বর্তমান রেকর্ড লোড করে পর্যালোচনার পরে আবার চেষ্টা করুন।",
  denied: "আপনার বর্তমান অ্যাকাউন্ট এই কাজ করতে পারে না।",
  limited: "অনেক অনুরোধ হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
};
const labels: Record<string, [string, string]> = {
  WAITING: ["উত্তরের অপেক্ষায়", "Waiting for reply"],
  SIMULATED: ["অনুকরণ করা ফল", "Simulated results"],
  CREDENTIAL_CHAIN_UNVERIFIED: [
    "স্বয়ংক্রিয় পরিচয়পত্র যাচাই হয়নি",
    "Default credential chain unverified",
  ],
  UP: ["সচল", "Available"],
  UNAVAILABLE: ["উপলব্ধ নয়", "Unavailable"],
  OBSERVED: ["পর্যবেক্ষিত", "Observed"],
  MOCK: ["মক প্রোভাইডার", "Mock provider"],
  NOT_CONFIGURED: ["কনফিগার করা নেই", "Not configured"],
  CONFIGURED_UNVERIFIED: ["কনফিগার করা, যাচাই হয়নি", "Configured, unverified"],
  EMAIL: ["ইমেইল", "Email"],
  STORAGE: ["ফাইল সংরক্ষণ", "Storage"],
  STRIPE: ["Stripe", "Stripe"],
  VIDEO: ["ভিডিও রুম", "Video rooms"],
  SMS: ["এসএমএস", "SMS"],
  PUSH: ["পুশ বার্তা", "Push notifications"],
  CLINICAL: ["চিকিৎসা বার্তা", "Clinical notifications"],
  ACTIVE: ["সক্রিয়", "Active"],
  TRIALING: ["পরীক্ষামূলক", "Trialing"],
  PAST_DUE: ["বকেয়া", "Past due"],
  CANCELED: ["বাতিল", "Canceled"],
  EXPIRED: ["মেয়াদোত্তীর্ণ", "Expired"],
  PENDING: ["অপেক্ষমাণ", "Pending"],
  PAID: ["পরিশোধিত", "Paid"],
  FAILED: ["ব্যর্থ", "Failed"],
  REFUNDED: ["ফেরত দেওয়া", "Refunded"],
  OPEN: ["খোলা", "Open"],
  IN_PROGRESS: ["চলমান", "In progress"],
  WAITING_REQUESTER: ["অনুরোধকারীর অপেক্ষায়", "Waiting for requester"],
  RESOLVED: ["সমাধান হয়েছে", "Resolved"],
  CLOSED: ["বন্ধ", "Closed"],
  STARTER: ["স্টার্টার", "Starter"],
  PRO: ["প্রো", "Pro"],
  ENTERPRISE: ["এন্টারপ্রাইজ", "Enterprise"],
  SUBMITTED: ["জমা হয়েছে", "Submitted"],
  TRIAGED: ["বাছাই হয়েছে", "Triaged"],
  ASSIGNED: ["দায়িত্ব দেওয়া", "Assigned"],
  SCHEDULED: ["সময় নির্ধারিত", "Scheduled"],
  COMPLETED: ["সম্পন্ন", "Completed"],
  CANCELLED: ["বাতিল", "Cancelled"],
};
export function platformMessages(locale: Locale) {
  return locale === "bn" ? bn : en;
}
export function platformLabel(locale: Locale, value: string) {
  return labels[value]?.[locale === "bn" ? 0 : 1] ?? value;
}
export function platformError(locale: Locale, code: string) {
  const t = platformMessages(locale);
  return code === "VALIDATION_FAILED"
    ? t.validation
    : code === "PASSWORD_CONFIRMATION_FAILED"
      ? t.passwordError
      : ["SETTINGS_CONFLICT", "CONFLICT"].includes(code)
        ? t.conflict
        : ["FORBIDDEN", "AUTHORIZATION_CHANGED", "UNAUTHORIZED"].includes(code)
          ? t.denied
          : code === "RATE_LIMITED"
            ? t.limited
            : t.error;
}
