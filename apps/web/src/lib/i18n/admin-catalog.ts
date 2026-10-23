import type { Locale } from "./locale";
const copy = {
  PAID_COURSE_NOT_ENABLED: [
    "Paid courses can be saved as drafts. Only free courses can be published for now.",
    "পেইড কোর্স খসড়ায় রাখা যায়। আপাতত শুধু ফ্রি কোর্স প্রকাশ করা যাবে।",
  ],
  viewCourses: ["View course catalog", "কোর্সের তালিকা দেখুন"],
  products: ["Products", "পণ্য"],
  media: ["Media uploads", "মিডিয়া আপলোড"],
  newProduct: ["Create product", "পণ্য তৈরি করুন"],
  edit: ["Edit product", "পণ্য সম্পাদনা"],
  details: ["View details", "বিস্তারিত দেখুন"],
  back: ["Back to products", "পণ্যের তালিকায় ফিরুন"],
  search: ["Search title or slug", "শিরোনাম বা স্লাগ খুঁজুন"],
  apply: ["Apply filters", "ফিল্টার প্রয়োগ করুন"],
  all: ["All", "সব"],
  type: ["Product type", "পণ্যের ধরন"],
  publication: ["Publication", "প্রকাশনার অবস্থা"],
  DRAFT: ["Draft", "খসড়া"],
  PUBLISHED: ["Published", "প্রকাশিত"],
  title: ["Title", "শিরোনাম"],
  slug: [
    "Slug (lowercase letters, numbers and hyphens)",
    "স্লাগ (ছোট ইংরেজি অক্ষর, সংখ্যা ও হাইফেন)",
  ],
  description: ["Description", "বিবরণ"],
  priceCents: [
    "Price in cents / poisha (integer)",
    "মূল্য সেন্ট / পয়সায় (পূর্ণসংখ্যা)",
  ],
  discountPriceCents: [
    "Discount price in cents / poisha (optional)",
    "ছাড়ের মূল্য সেন্ট / পয়সায় (ঐচ্ছিক)",
  ],
  currency: ["Currency", "মুদ্রা"],
  minSubscriptionTier: [
    "Minimum subscription tier",
    "ন্যূনতম সাবস্ক্রিপশন স্তর",
  ],
  save: ["Save product", "পণ্য সংরক্ষণ করুন"],
  saved: ["Changes saved.", "পরিবর্তন সংরক্ষিত হয়েছে।"],
  saving: ["Saving…", "সংরক্ষণ হচ্ছে…"],
  loading: ["Loading…", "লোড হচ্ছে…"],
  empty: ["No matching records.", "কোনো তথ্য পাওয়া যায়নি।"],
  retry: ["Try again", "আবার চেষ্টা করুন"],
  next: ["Next", "পরবর্তী"],
  previous: ["Previous", "আগের"],
  action: ["Product action", "পণ্যের ব্যবস্থা"],
  PUBLISH: ["Publish", "প্রকাশ করুন"],
  UNPUBLISH: ["Unpublish", "অপ্রকাশিত করুন"],
  DELETE: ["Delete product", "পণ্য মুছুন"],
  reason: ["Reason (10–500 characters)", "কারণ (১০–৫০০ অক্ষর)"],
  confirm: ["Confirm product action", "পণ্যের ব্যবস্থা নিশ্চিত করুন"],
  asset: ["Attached asset", "সংযুক্ত ফাইল"],
  noAsset: [
    "No asset attached. Upload and attach a file before publishing.",
    "কোনো ফাইল সংযুক্ত নেই। প্রকাশের আগে ফাইল আপলোড ও সংযুক্ত করুন।",
  ],
  upload: ["Upload an asset", "ফাইল আপলোড করুন"],
  createdAt: ["Created · Dhaka time", "তৈরির সময় · ঢাকা সময়"],
  updatedAt: ["Updated · Dhaka time", "পরিবর্তনের সময় · ঢাকা সময়"],
  curriculum: [
    "Course chapters, resources and learner progress are not included in product master management.",
    "পণ্যের মূল তথ্য ব্যবস্থাপনায় কোর্সের অধ্যায়, রিসোর্স ও শিক্ষার্থীর অগ্রগতি অন্তর্ভুক্ত নয়।",
  ],
  selectProduct: [
    "Select an unpublished product (up to 100 matches)",
    "অপ্রকাশিত পণ্য বেছে নিন (সর্বোচ্চ ১০০টি ফলাফল)",
  ],
  productSearch: ["Find a draft product", "খসড়া পণ্য খুঁজুন"],
  file: ["Select file", "ফাইল বেছে নিন"],
  start: ["Start upload", "আপলোড শুরু করুন"],
  uploadHint: [
    "Video: MP4/WebM/MOV/MKV, up to 10 GB. eBook: PDF/EPUB, up to 150 MB. Tool: XLSX/XLS, up to 50 MB.",
    "ভিডিও: MP4/WebM/MOV/MKV, সর্বোচ্চ ১০ GB। ই-বুক: PDF/EPUB, সর্বোচ্চ ১৫০ MB। টুল: XLSX/XLS, সর্বোচ্চ ৫০ MB।",
  ],
  inventory: ["Tracked uploads", "নথিভুক্ত আপলোড"],
  inventoryHint: [
    "This inventory lists managed uploads. Existing product assets can be inspected in product details.",
    "এখানে নথিভুক্ত আপলোড দেখানো হয়। আগের পণ্যের ফাইল পণ্যের বিস্তারিত পাতায় দেখুন।",
  ],
  filename: ["File name", "ফাইলের নাম"],
  state: ["Upload state", "আপলোডের অবস্থা"],
  progress: ["Upload progress", "আপলোডের অগ্রগতি"],
  uploading: [
    "Uploading file parts… Keep this page open.",
    "ফাইলের অংশ আপলোড হচ্ছে… পাতাটি খোলা রাখুন।",
  ],
  abort: ["Abort upload", "আপলোড বাতিল করুন"],
  abortConfirm: [
    "Abort this upload? Uploaded parts will be discarded.",
    "এই আপলোড বাতিল করবেন? আপলোড করা অংশগুলো মুছে যাবে।",
  ],
  resume: [
    "Re-select the same file to retry uploading",
    "একই ফাইল আবার বেছে নিয়ে আপলোড চেষ্টা করুন",
  ],
  retryUpload: ["Retry file upload", "ফাইল আপলোড আবার চেষ্টা করুন"],
  complete: ["Upload completed.", "আপলোড সম্পন্ন হয়েছে।"],
  process: [
    "Process video / retry failed processing",
    "ভিডিও প্রক্রিয়া করুন / ব্যর্থ প্রক্রিয়া আবার চেষ্টা করুন",
  ],
  processing: ["Video processing", "ভিডিও প্রক্রিয়াকরণ"],
  attach: [
    "Attach this asset to its product",
    "পণ্যের সঙ্গে এই ফাইল সংযুক্ত করুন",
  ],
  attachConfirm: [
    "Attach this file? The product must be unpublished.",
    "এই ফাইল সংযুক্ত করবেন? পণ্যটি অপ্রকাশিত থাকতে হবে।",
  ],
  refresh: ["Refresh status", "অবস্থা আবার দেখুন"],
  backMedia: ["Back to uploads", "আপলোডের তালিকায় ফিরুন"],
  size: ["File size (bytes)", "ফাইলের আকার (বাইট)"],
  owned: [
    "Only the uploader or a Super Admin can change this upload.",
    "শুধু আপলোডকারী বা সুপার অ্যাডমিন এই আপলোডের ব্যবস্থা নিতে পারেন।",
  ],
  recover: [
    "After an interruption, re-select the same file to retry all parts, or abort and start again. Completed uploads and processing status remain in this inventory.",
    "বাধা পড়লে একই ফাইল বেছে নিয়ে সব অংশ আবার চেষ্টা করুন, অথবা বাতিল করে নতুনভাবে শুরু করুন। সম্পন্ন আপলোড ও প্রক্রিয়ার অবস্থা এই তালিকায় থাকে।",
  ],
  VIDEO_COURSE: ["Video course", "ভিডিও কোর্স"],
  EBOOK: ["eBook", "ই-বুক"],
  EXCEL_TOOL: ["Spreadsheet tool", "স্প্রেডশিট টুল"],
  STARTER: ["Starter", "স্টার্টার"],
  PRO: ["Pro", "প্রো"],
  ENTERPRISE: ["Enterprise", "এন্টারপ্রাইজ"],
  INITIALIZING: ["Initializing", "শুরু হচ্ছে"],
  UPLOADING: ["Waiting for file parts", "ফাইলের অংশের অপেক্ষায়"],
  UPLOADED: ["Uploaded and verified", "আপলোড ও যাচাই সম্পন্ন"],
  FAILED: ["Initialization failed", "শুরু করা ব্যর্থ"],
  ABORTED: ["Aborted", "বাতিল"],
  idle: ["Not queued", "সারিতে নেই"],
  waiting: ["Queued", "সারিতে আছে"],
  active: ["Processing", "প্রক্রিয়া চলছে"],
  delayed: ["Waiting to retry", "আবার চেষ্টার অপেক্ষায়"],
  completed: ["Processing completed", "প্রক্রিয়া সম্পন্ন"],
  failed: ["Processing failed", "প্রক্রিয়া ব্যর্থ"],
  unavailable: [
    "Processing service unavailable",
    "প্রক্রিয়াকরণ সেবা উপলব্ধ নয়",
  ],
  expired: ["Processing history expired", "প্রক্রিয়ার ইতিহাসের মেয়াদ শেষ"],
  DEFAULT: [
    "The request could not be completed. Try again.",
    "অনুরোধ সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।",
  ],
  NOT_FOUND: [
    "This record is missing or unavailable.",
    "তথ্যটি নেই অথবা উপলব্ধ নয়।",
  ],
  FORBIDDEN: [
    "Your account cannot perform this action.",
    "আপনার অ্যাকাউন্ট এই ব্যবস্থা নিতে পারে না।",
  ],
  VALIDATION_FAILED: [
    "Check the required fields, prices and file type.",
    "প্রয়োজনীয় তথ্য, মূল্য ও ফাইলের ধরন পরীক্ষা করুন।",
  ],
  PRODUCT_VERSION_CONFLICT: [
    "The product changed. Reload and review before saving again.",
    "পণ্যের তথ্য বদলেছে। আবার সংরক্ষণের আগে তথ্য লোড করে পর্যালোচনা করুন।",
  ],
  CONTENT_PROVIDER_MISMATCH: [
    "This product uses a different content source.",
    "এই পণ্যের ভিডিওর উৎস আলাদা।",
  ],
  COURSE_MUST_BE_UNPUBLISHED: [
    "Unpublish this course before changing lessons.",
    "লেসন বদলানোর আগে কোর্স অপ্রকাশিত করুন।",
  ],
  INVALID_YOUTUBE_PRICING: [
    "YouTube courses require free enrollment.",
    "YouTube কোর্সে ফ্রি এনরোলমেন্ট প্রয়োজন।",
  ],
  ASSET_NOT_READY: [
    "Save at least one enrolled lesson for a YouTube course, or attach a completed asset for an uploaded product before publishing.",
    "YouTube কোর্সে অন্তত একটি এনরোলড লেসন সংরক্ষণ করুন। আপলোড করা পণ্যের ক্ষেত্রে প্রকাশের আগে সম্পন্ন ফাইল সংযুক্ত করুন।",
  ],
  UPLOAD_STATE_CONFLICT: [
    "The upload changed. Refresh its status.",
    "আপলোডের অবস্থা বদলেছে। অবস্থা আবার দেখুন।",
  ],
  UPLOAD_BUSY: [
    "Initialization is still pending. Refresh the session or abort and start a new upload.",
    "আপলোড শুরু হওয়া অপেক্ষমাণ। অবস্থা আবার দেখুন অথবা বাতিল করে নতুন আপলোড শুরু করুন।",
  ],
  UPLOAD_REQUEST_CONFLICT: [
    "This upload request does not match its saved session. Start a new upload.",
    "এই অনুরোধ সংরক্ষিত আপলোডের সঙ্গে মেলে না। নতুন আপলোড শুরু করুন।",
  ],
  UPLOAD_VERIFICATION_FAILED: [
    "Stored file verification failed. Inspect the upload before retrying.",
    "সংরক্ষিত ফাইলের যাচাই ব্যর্থ। আবার চেষ্টার আগে আপলোড দেখুন।",
  ],
  INVALID_UPLOAD: [
    "Select a supported matching file and an active upload session.",
    "উপযুক্ত মিল থাকা ফাইল ও সক্রিয় আপলোড বেছে নিন।",
  ],
  MEDIA_UNAVAILABLE: [
    "Storage or processing is unavailable. Refresh the saved session before retrying.",
    "ফাইল সংরক্ষণ বা প্রক্রিয়াকরণ উপলব্ধ নয়। আবার চেষ্টার আগে সংরক্ষিত আপলোডের অবস্থা দেখুন।",
  ],
  FILE_UPLOAD_FAILED: [
    "File transfer failed. Check your connection and storage CORS settings (PUT and exposed ETag), then retry.",
    "ফাইল পাঠানো ব্যর্থ। সংযোগ ও স্টোরেজের CORS সেটিংস (PUT এবং প্রকাশিত ETag) পরীক্ষা করে আবার চেষ্টা করুন।",
  ],
  CONFLICT: [
    "This slug or record changed. Choose a unique slug or reload the record.",
    "স্লাগ বা তথ্য বদলেছে। আলাদা স্লাগ বেছে নিন বা তথ্য আবার লোড করুন।",
  ],
} as const;
export type CatalogMessages = { [K in keyof typeof copy]: string };
export function getCatalogMessages(locale: Locale): CatalogMessages {
  return Object.fromEntries(
    Object.entries(copy).map(([k, v]) => [k, v[locale === "bn" ? 1 : 0]]),
  ) as CatalogMessages;
}
export function catalogLabel(t: CatalogMessages, key: string) {
  return (t as Record<string, string>)[key] ?? key;
}
