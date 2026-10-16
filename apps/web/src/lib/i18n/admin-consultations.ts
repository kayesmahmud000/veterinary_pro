import type { Locale } from "./locale";
const copy = {
  triage: ["Triage queue", "প্রাথমিক বাছাই"],
  consultations: ["Consultation history", "পরামর্শের ইতিহাস"],
  operations: ["Consultation operations", "পরামর্শ ব্যবস্থাপনা"],
  intro: [
    "Review requests, assignments and recorded consultation outcomes.",
    "অনুরোধ, দায়িত্ব বণ্টন ও সংরক্ষিত পরামর্শের ফলাফল পর্যালোচনা করুন।",
  ],
  search: [
    "Search complaint, participant or record ID",
    "অভিযোগ, অংশগ্রহণকারী বা রেকর্ড আইডি দিয়ে খুঁজুন",
  ],
  status: ["Status", "অবস্থা"],
  type: ["Consultation type", "পরামর্শের ধরন"],
  all: ["All", "সব"],
  apply: ["Apply filters", "ফিল্টার প্রয়োগ করুন"],
  loading: ["Loading records…", "তথ্য লোড হচ্ছে…"],
  empty: ["No matching consultations.", "মিল পাওয়া কোনো পরামর্শ নেই।"],
  details: ["View details", "বিস্তারিত দেখুন"],
  next: ["Next page", "পরের পৃষ্ঠা"],
  previous: ["Previous page", "আগের পৃষ্ঠা"],
  retry: ["Try again", "আবার চেষ্টা করুন"],
  back: ["Back to the list", "তালিকায় ফিরুন"],
  refresh: ["Reload and review", "আবার লোড করে পর্যালোচনা করুন"],
  unavailable: [
    "The request could not be completed. Try again.",
    "অনুরোধ সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।",
  ],
  deleted: ["Deleted or unavailable", "মুছে ফেলা বা অনুপলব্ধ"],
  none: ["Not recorded", "সংরক্ষিত নেই"],
  farmer: ["Farmer", "খামারি"],
  vet: ["Veterinarian", "পশুচিকিৎসক"],
  farm: ["Farm", "খামার"],
  animal: ["Animal", "পশু"],
  complaint: ["Request complaint", "অনুরোধের অভিযোগ"],
  fee: ["Consultation fee", "পরামর্শের মূল্য"],
  payment: ["Payment status", "পেমেন্টের অবস্থা"],
  scheduled: ["Scheduled time (Asia/Dhaka)", "নির্ধারিত সময় (এশিয়া/ঢাকা)"],
  assigned: ["Assigned time (Asia/Dhaka)", "দায়িত্ব দেওয়ার সময় (এশিয়া/ঢাকা)"],
  created: ["Created (Asia/Dhaka)", "তৈরির সময় (এশিয়া/ঢাকা)"],
  updated: ["Updated (Asia/Dhaka)", "পরিবর্তনের সময় (এশিয়া/ঢাকা)"],
  candidates: ["Assignment candidates", "দায়িত্ব দেওয়ার সম্ভাব্য চিকিৎসক"],
  noCandidates: [
    "No eligible veterinarian is currently available. Reload candidates to check again.",
    "এখন উপযুক্ত পশুচিকিৎসক পাওয়া যাচ্ছে না। আবার তালিকা লোড করে দেখুন।",
  ],
  candidateLimit: [
    "Candidate discovery is limited to 100 active veterinarians. Additional veterinarians were not evaluated.",
    "প্রার্থী অনুসন্ধান ১০০ জন সক্রিয় চিকিৎসকে সীমিত। অতিরিক্ত চিকিৎসকদের মূল্যায়ন করা হয়নি।",
  ],
  workload: ["Active cases / capacity", "চলমান কেস / ধারণক্ষমতা"],
  score: ["Rank score", "ক্রম নির্ধারণের স্কোর"],
  specialties: ["Specialties", "বিশেষজ্ঞতা"],
  eligible: ["Eligible", "উপযুক্ত"],
  availability: ["Available now", "এখন উপলব্ধ"],
  yes: ["Yes", "হ্যাঁ"],
  no: ["No", "না"],
  choose: ["Select a veterinarian", "পশুচিকিৎসক বেছে নিন"],
  action: ["Administrative action", "প্রশাসনিক পদক্ষেপ"],
  reason: ["Reason for this change", "পরিবর্তনের কারণ"],
  password: ["Confirm your current password", "বর্তমান পাসওয়ার্ড নিশ্চিত করুন"],
  review: ["Review change", "পরিবর্তন পর্যালোচনা করুন"],
  saving: ["Saving…", "সংরক্ষণ হচ্ছে…"],
  saved: [
    "Change saved. An in-app notification was recorded for the assigned veterinarian, if present.",
    "পরিবর্তন সংরক্ষিত হয়েছে। দায়িত্বপ্রাপ্ত চিকিৎসক থাকলে অ্যাপের ভেতরে বিজ্ঞপ্তি সংরক্ষিত হয়েছে।",
  ],
  confirm: ["Confirm consultation change", "পরামর্শের পরিবর্তন নিশ্চিত করুন"],
  assignmentHint: [
    "Existing appointment times are preserved. Automatic assignment selects the best eligible veterinarian from the discovered candidate list at save time.",
    "বর্তমান অ্যাপয়েন্টমেন্টের সময় অপরিবর্তিত থাকবে। স্বয়ংক্রিয় বণ্টনে সংরক্ষণের সময়ে অনুসন্ধানে পাওয়া তালিকা থেকে সর্বোত্তম উপযুক্ত চিকিৎসক বেছে নেওয়া হবে।",
  ],
  cancellationHint: [
    "Cancellation preserves payment records; it does not refund a payment or release a hold.",
    "বাতিল করলে পেমেন্টের তথ্য অক্ষত থাকবে; অর্থ ফেরত বা আটকে রাখা অর্থ ছাড় হবে না।",
  ],
  reconciliation: [
    "Only supported changes are available here. Payment-linked or ongoing/terminal care requires payment or clinical reconciliation.",
    "এখানে শুধু সমর্থিত পরিবর্তন করা যাবে। পেমেন্ট-সংযুক্ত বা চলমান/শেষ হওয়া চিকিৎসায় পেমেন্ট বা চিকিৎসাসংক্রান্ত সমন্বয় প্রয়োজন।",
  ],
  readonly: [
    "No administrative change is available for this consultation.",
    "এই পরামর্শে এখন কোনো প্রশাসনিক পরিবর্তন করা যাবে না।",
  ],
  history: ["Operational history", "পরিচালনার ইতিহাস"],
  notifications: ["Stored notification outcomes", "বিজ্ঞপ্তির সংরক্ষিত ফলাফল"],
  notificationHint: [
    "These are stored outcomes. In-app records do not prove SMS, email or push delivery to a recipient.",
    "এগুলো সংরক্ষিত ফলাফল। অ্যাপের রেকর্ড দিয়ে প্রাপকের কাছে এসএমএস, ইমেইল বা পুশ পৌঁছানো প্রমাণিত হয় না।",
  ],
  noHistory: ["No stored events.", "কোনো ঘটনা সংরক্ষিত নেই।"],
  truncated: [
    "Showing the first 50 records.",
    "প্রথম ৫০টি রেকর্ড দেখানো হচ্ছে।",
  ],
  read: ["Read at", "পড়ার সময়"],
  SUBMITTED: ["Submitted", "জমা দেওয়া"],
  ASSIGNED: ["Assigned", "দায়িত্ব দেওয়া"],
  IN_PROGRESS: ["In progress", "চলমান"],
  COMPLETED: ["Completed", "সম্পন্ন"],
  CANCELLED: ["Cancelled", "বাতিল"],
  ASYNC_TICKET: ["Written consultation", "লিখিত পরামর্শ"],
  LIVE_VIDEO: ["Live video", "সরাসরি ভিডিও"],
  UNPAID: ["Unpaid", "অপরিশোধিত"],
  AUTHORIZED: ["Payment authorized", "পেমেন্ট অনুমোদিত"],
  CAPTURED: ["Payment captured", "পেমেন্ট গ্রহণ করা"],
  RELEASED: ["Hold released", "আটকানো অর্থ ছাড়া"],
  FAILED: ["Failed", "ব্যর্থ"],
  ASSIGN: ["Assign / reassign manually", "হাতে দায়িত্ব দিন / বদলান"],
  AUTO_ASSIGN: ["Assign automatically", "স্বয়ংক্রিয় দায়িত্ব দিন"],
  CANCEL: ["Cancel consultation", "পরামর্শ বাতিল করুন"],
  UNAVAILABLE: ["Currently unavailable", "এখন অনুপলব্ধ"],
  CAPACITY: ["At case capacity", "কেসের সীমা পূর্ণ"],
  SCHEDULE: [
    "Schedule conflict or outside working hours",
    "সময়সূচির সংঘাত বা কর্মঘণ্টার বাইরে",
  ],
  PROFILE_REQUIRED: [
    "Availability profile required",
    "উপলভ্যতার প্রোফাইল প্রয়োজন",
  ],
  PENDING: ["Pending", "অপেক্ষমাণ"],
  SENT: ["Stored as sent", "পাঠানো হিসেবে সংরক্ষিত"],
  IN_APP: ["In app", "অ্যাপের ভেতরে"],
  EMAIL: ["Email", "ইমেইল"],
  SMS: ["SMS", "এসএমএস"],
  PUSH: ["Push", "পুশ"],
  CONSULTATION_REQUEST_SUBMITTED: [
    "Consultation request submitted",
    "পরামর্শের অনুরোধ জমা",
  ],
  CONSULTATION_CANCELLED_BY_TRIAGE: [
    "Cancelled during triage",
    "প্রাথমিক বাছাইয়ে বাতিল",
  ],
  CONSULTATION_PAYMENT_HOLD_CREATED: [
    "Payment hold created",
    "পেমেন্টের অর্থ আটকানো",
  ],
  CONSULTATION_PAYMENT_HOLD_CONFIRMED: [
    "Payment hold confirmed",
    "পেমেন্টের আটকানো অর্থ নিশ্চিত",
  ],
  CONSULTATION_PAYMENT_CAPTURED: [
    "Consultation payment captured",
    "পরামর্শের পেমেন্ট গ্রহণ",
  ],
  CONSULTATION_PAYMENT_HOLD_RELEASED: [
    "Payment hold released",
    "পেমেন্টের আটকানো অর্থ ছাড়া",
  ],
  CONSULTATION_CREATED: ["Consultation created", "পরামর্শ তৈরি"],
  CONSULTATION_SUBMITTED: ["Request submitted", "অনুরোধ জমা"],
  CONSULTATION_ASSIGNED: ["Veterinarian assigned", "চিকিৎসককে দায়িত্ব দেওয়া"],
  CONSULTATION_STARTED: ["Consultation started", "পরামর্শ শুরু"],
  CONSULTATION_COMPLETED: ["Consultation completed", "পরামর্শ সম্পন্ন"],
  CONSULTATION_CANCELLED: ["Consultation cancelled", "পরামর্শ বাতিল"],
  CONSULTATION_MANUALLY_ASSIGNED: ["Manually assigned", "হাতে দায়িত্ব দেওয়া"],
  CONSULTATION_AUTO_ASSIGNED: [
    "Automatically assigned",
    "স্বয়ংক্রিয় দায়িত্ব দেওয়া",
  ],
  CONSULTATION_ADMIN_ASSIGNED: [
    "Administrator assigned veterinarian",
    "প্রশাসক চিকিৎসককে দায়িত্ব দিয়েছেন",
  ],
  CONSULTATION_ADMIN_AUTO_ASSIGNED: [
    "Administrator assigned automatically",
    "প্রশাসক স্বয়ংক্রিয় দায়িত্ব দিয়েছেন",
  ],
  CONSULTATION_ADMIN_CANCELLED: [
    "Administrator cancelled consultation",
    "প্রশাসক পরামর্শ বাতিল করেছেন",
  ],
  CONSULTATION_VERSION_CONFLICT: [
    "This consultation changed. Reload and review the latest record before submitting again. Your reason and selection are retained.",
    "পরামর্শটি বদলেছে। আবার জমা দেওয়ার আগে নতুন তথ্য লোড করে দেখুন। আপনার কারণ ও পছন্দ রাখা হয়েছে।",
  ],
  CONSULTATION_ACTION_UNAVAILABLE: [
    "This action or veterinarian is no longer available. Reload and review before trying again.",
    "এই পদক্ষেপ বা চিকিৎসক এখন আর উপলব্ধ নেই। আবার লোড করে দেখে চেষ্টা করুন।",
  ],
  PASSWORD_CONFIRMATION_FAILED: [
    "The password did not match. Enter it again.",
    "পাসওয়ার্ড মেলেনি। আবার লিখুন।",
  ],
  VALIDATION_FAILED: [
    "Check the action, veterinarian, reason (5–1000 characters) and password.",
    "পদক্ষেপ, চিকিৎসক, কারণ (৫–১০০০ অক্ষর) ও পাসওয়ার্ড পরীক্ষা করুন।",
  ],
  RATE_LIMITED: [
    "Too many attempts. Try again later.",
    "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।",
  ],
  RATE_LIMIT_UNAVAILABLE: [
    "Confirmation is temporarily unavailable. Try again shortly.",
    "নিশ্চিত করার ব্যবস্থা সাময়িকভাবে পাওয়া যাচ্ছে না। কিছুক্ষণ পর চেষ্টা করুন।",
  ],
  FORBIDDEN: [
    "You no longer have permission for this action.",
    "এই পদক্ষেপে আপনার অনুমতি নেই।",
  ],
  UNAUTHORIZED: ["Sign in again to continue.", "এগিয়ে যেতে আবার সাইন ইন করুন।"],
  AUTHORIZATION_CHANGED: [
    "Your account permissions changed. Reload your session.",
    "আপনার অ্যাকাউন্টের অনুমতি বদলেছে। সেশন আবার লোড করুন।",
  ],
  NOT_FOUND: ["The consultation was not found.", "পরামর্শটি পাওয়া যায়নি।"],
  TIMEOUT: [
    "The request timed out. Review the record before trying again.",
    "অনুরোধের সময় শেষ হয়েছে। আবার চেষ্টা করার আগে রেকর্ড দেখে নিন।",
  ],
} as const;
export type ConsultationMessages = { [K in keyof typeof copy]: string };
export function getConsultationMessages(locale: Locale): ConsultationMessages {
  return Object.fromEntries(
    Object.entries(copy).map(([key, value]) => [
      key,
      value[locale === "bn" ? 1 : 0],
    ]),
  ) as ConsultationMessages;
}
export function consultationLabel(t: ConsultationMessages, key: string) {
  return (t as Record<string, string>)[key] ?? key;
}
