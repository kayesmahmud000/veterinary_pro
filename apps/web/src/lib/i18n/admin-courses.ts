import type { Locale } from "./locale";
const copy = {
  course: ["Course", "কোর্স"],
  actions: ["Actions", "কার্যক্রম"],
  addNew: ["Add new course", "নতুন কোর্স যোগ করুন"],
  manageIntro: [
    "Manage your courses, review enrollments and publish when everything is ready.",
    "কোর্স পরিচালনা করুন, এনরোলমেন্ট দেখুন ও প্রস্তুত হলে প্রকাশ করুন।",
  ],
  details: ["View details", "বিস্তারিত দেখুন"],
  edit: ["Edit course", "কোর্স সম্পাদনা"],
  delete: ["Delete course", "কোর্স মুছুন"],
  publish: ["Publish course", "কোর্স প্রকাশ করুন"],
  unpublish: ["Unpublish course", "কোর্স অপ্রকাশিত করুন"],
  draft: ["Draft", "খসড়া"],
  live: ["Published", "প্রকাশিত"],
  freeCourse: ["Free", "ফ্রি"],
  paidCourse: ["Paid · future setup", "পেইড · ভবিষ্যতের প্রস্তুতি"],
  pricing: ["Course access", "কোর্সের ধরন"],
  paidHint: [
    "Paid pricing is draft-only for now. No payment gateway is connected; only free courses can be published or enrolled in.",
    "পেইড মূল্য আপাতত শুধু খসড়ায় রাখা যায়। পেমেন্ট গেটওয়ে যুক্ত নেই; শুধু ফ্রি কোর্স প্রকাশ ও এনরোল করা যাবে।",
  ],
  publicHint: [
    "Use public YouTube videos with embedding enabled. Enrollment is free; a private YouTube video cannot be unlocked by signing in here.",
    "এমবেড চালু থাকা পাবলিক YouTube ভিডিও দিন। এনরোলমেন্ট ফ্রি; এখানে লগইন করে প্রাইভেট YouTube ভিডিও খোলা যায় না।",
  ],
  price: ["Future price in cents / poisha", "ভবিষ্যৎ মূল্য সেন্ট / পয়সায়"],
  discount: [
    "Future discount price (optional)",
    "ভবিষ্যৎ ছাড়ের মূল্য (ঐচ্ছিক)",
  ],
  thumbnail: [
    "Course thumbnail (optional)",
    "কোর্সের থাম্বনেইল (ঐচ্ছিক)",
  ],
  thumbnailHint: [
    "Use a public HTTPS image. Leave empty to use a public demo thumbnail or the course fallback.",
    "পাবলিক HTTPS ছবির লিংক দিন। খালি রাখলে পাবলিক ডেমোর ছবি বা কোর্সের বিকল্প নকশা দেখা যাবে।",
  ],
  lessonCount: ["Lessons", "লেসন"],
  learners: ["Enrolled learners", "এনরোলড শিক্ষার্থী"],
  unavailableCount: [
    "Not available from this API version",
    "এই API সংস্করণে পাওয়া যাচ্ছে না",
  ],
  created: ["Created", "তৈরি"],
  updated: ["Updated", "পরিবর্তিত"],
  closeDialog: ["Close", "বন্ধ করুন"],
  actionReason: ["Reason (10–500 characters)", "কারণ (১০–৫০০ অক্ষর)"],
  confirm: ["Confirm action", "নিশ্চিত করুন"],
  cancel: ["Cancel", "বাতিল"],
  working: ["Saving…", "সংরক্ষণ হচ্ছে…"],
  actionSaved: ["Course updated.", "কোর্স পরিবর্তন সংরক্ষিত হয়েছে।"],
  deleted: ["Course deleted.", "কোর্স মুছে দেওয়া হয়েছে।"],
  deleteHint: [
    "This hides the course from learners. Existing enrollments, lessons and video records are retained.",
    "শিক্ষার্থীরা কোর্সটি আর দেখতে পারবেন না। আগের এনরোলমেন্ট, লেসন ও ভিডিওর রেকর্ড অক্ষত থাকবে।",
  ],
  unpublishHint: [
    "The course will be unavailable to learners until it is published again. Enrollments are retained.",
    "আবার প্রকাশ না করা পর্যন্ত শিক্ষার্থীরা কোর্সটি দেখতে পারবেন না। এনরোলমেন্ট অক্ষত থাকবে।",
  ],
  publishHint: [
    "Publish the saved information and lessons so learners can find this free course.",
    "সংরক্ষিত তথ্য ও লেসন প্রকাশ করুন, যাতে শিক্ষার্থীরা ফ্রি কোর্সটি খুঁজে পান।",
  ],
  information: ["Course information", "কোর্সের তথ্য"],
  videosStep: ["Lessons and videos", "লেসন ও ভিডিও"],
  reviewStep: ["Review and publish", "দেখে প্রকাশ করুন"],
  continue: ["Save and continue", "সংরক্ষণ করে এগিয়ে যান"],
  review: ["Continue to review", "দেখে নেওয়ার ধাপে যান"],
  previous: ["Previous step", "আগের ধাপ"],
  saveDraft: ["Save as draft", "খসড়া রাখুন"],
  finish: ["Finish editing", "সম্পাদনা শেষ করুন"],
  savedDraft: [
    "Draft saved. Return to courses whenever you are ready.",
    "খসড়া সংরক্ষিত। প্রস্তুত হলে কোর্সের তালিকা থেকে ফিরে আসুন।",
  ],
  saveLessonsFirst: [
    "Save your lesson changes before continuing.",
    "এগোনোর আগে লেসনের পরিবর্তন সংরক্ষণ করুন।",
  ],
  publishedEditing: [
    "Course information can be updated while published. Unpublish here before changing lessons.",
    "প্রকাশিত অবস্থায় কোর্সের তথ্য বদলানো যায়। লেসন বদলানোর আগে এখানেই অপ্রকাশিত করুন।",
  ],
  readyHint: [
    "Add and save at least one enrollment lesson before publishing. Public demos are optional.",
    "প্রকাশের আগে অন্তত একটি এনরোলমেন্ট লেসন যোগ করে সংরক্ষণ করুন। পাবলিক ডেমো ঐচ্ছিক।",
  ],
  savedOnly: [
    "This review shows saved course information and lessons.",
    "এখানে সংরক্ষিত কোর্সের তথ্য ও লেসন দেখানো হচ্ছে।",
  ],
  invalidInfo: [
    "Check the highlighted information. Paid drafts need a positive integer price; active courses must remain free.",
    "চিহ্নিত তথ্য পরীক্ষা করুন। পেইড খসড়ায় ধনাত্মক পূর্ণসংখ্যার মূল্য দিন; প্রকাশিত কোর্স ফ্রি থাকতে হবে।",
  ],
  fieldError: ["Check this value.", "এই তথ্যটি পরীক্ষা করুন।"],
  duplicateSlug: [
    "This slug is already used. Check for the existing course before saving again.",
    "এই স্লাগ আগে ব্যবহৃত হয়েছে। আবার সংরক্ষণের আগে আগের কোর্সটি খুঁজুন।",
  ],
  uncertainCreate: [
    "We could not confirm the save. Check for a matching draft before trying to create it again.",
    "সংরক্ষণ নিশ্চিত করা যায়নি। আবার তৈরি করার আগে একই খসড়া আছে কি না দেখুন।",
  ],
  findDraft: ["Find matching draft", "একই খসড়া খুঁজুন"],
  openDraft: ["Open matching draft", "একই খসড়া খুলুন"],
  noMatchingDraft: [
    "No matching course found yet. Retry with the same slug; the earlier request may still finish.",
    "এখনও একই কোর্স পাওয়া যায়নি। একই স্লাগ দিয়ে আবার চেষ্টা করুন; আগের অনুরোধটি এখনও শেষ হতে পারে।",
  ],
  retryIdentity: [
    "The submitted slug stays fixed for safe retries. Return to the course list to start a different course.",
    "নিরাপদে আবার চেষ্টা করতে জমা দেওয়া স্লাগটি অপরিবর্তিত থাকবে। অন্য কোর্স শুরু করতে কোর্সের তালিকায় ফিরুন।",
  ],
  discardInfo: [
    "Discard unsaved course changes?",
    "কোর্সের অসংরক্ষিত পরিবর্তন বাদ দেবেন?",
  ],
  emptyList: [
    "No courses match. Add a new course or change your filters.",
    "মিল আছে এমন কোর্স নেই। নতুন কোর্স যোগ করুন বা ফিল্টার বদলান।",
  ],
  currency: ["Currency", "মুদ্রা"],

  courses: ["Courses", "কোর্সসমূহ"],
  intro: [
    "Create a free YouTube course, add video lessons, then publish it when it is ready.",
    "ফ্রি YouTube কোর্স তৈরি করুন, ভিডিও লেসন যোগ করুন, তারপর প্রস্তুত হলে প্রকাশ করুন।",
  ],
  createHeading: ["Add a course", "কোর্স যোগ করুন"],
  createAndContinue: [
    "Create course and add videos",
    "কোর্স তৈরি করে ভিডিও যোগ করুন",
  ],
  draftHint: [
    "This saves a draft course. Next, add YouTube video links and choose who can watch each lesson.",
    "কোর্সটি খসড়া হিসেবে সংরক্ষিত হবে। এরপর লেসনের YouTube লিংক দিন ও কারা দেখতে পারবেন তা বেছে নিন।",
  ],
  listHeading: ["Manage existing courses", "আগের কোর্স পরিচালনা করুন"],
  backCourses: ["Back to courses", "কোর্সের তালিকায় ফিরুন"],
  courseDetails: ["Course details and publication", "কোর্সের তথ্য ও প্রকাশনা"],
  emptyCourses: [
    "No matching courses yet. Create a course using the form above.",
    "কোনো কোর্স পাওয়া যায়নি। উপরের ফর্ম থেকে কোর্স তৈরি করুন।",
  ],
  invalidDetails: [
    "Check the course title, slug and description.",
    "কোর্সের শিরোনাম, স্লাগ ও বিবরণ পরীক্ষা করুন।",
  ],
  heading: ["YouTube course lessons", "YouTube কোর্সের লেসন"],
  source: ["Content source", "ভিডিওর উৎস"],
  INTERNAL: ["Uploaded asset", "আপলোড করা ফাইল"],
  YOUTUBE: ["YouTube · free enrollment", "YouTube · ফ্রি এনরোলমেন্ট"],
  manage: ["Manage course lessons", "কোর্সের লেসন পরিচালনা করুন"],
  hint: [
    "Add individual YouTube links. Demo lessons will be public; other lessons will require free enrollment after signing in.",
    "প্রতিটি লেসনের YouTube লিংক দিন। ডেমো সবার জন্য থাকবে; অন্য লেসন দেখতে সাইন ইন করে ফ্রি এনরোলমেন্ট লাগবে।",
  ],
  pending: [
    "Learner enrollment and course viewing are the next delivery step. This screen prepares the course content.",
    "ব্যবহারকারীর এনরোলমেন্ট ও কোর্স দেখার ব্যবস্থা পরের ধাপে আসবে। এখানে কোর্সের কনটেন্ট প্রস্তুত করুন।",
  ],
  free: [
    "YouTube courses are free. The subscription tier does not control course access.",
    "YouTube কোর্স ফ্রি। সাবস্ক্রিপশন স্তর দিয়ে এই কোর্সের প্রবেশাধিকার নিয়ন্ত্রিত হবে না।",
  ],
  published: [
    "Unpublish this course from product details before changing its lessons.",
    "লেসন বদলানোর আগে পণ্যের বিস্তারিত পাতা থেকে কোর্স অপ্রকাশিত করুন।",
  ],
  empty: [
    "No lessons yet. Add an enrolled lesson before publishing; demos are optional.",
    "এখনো লেসন নেই। প্রকাশের আগে অন্তত একটি এনরোলড লেসন দিন; ডেমো ঐচ্ছিক।",
  ],
  add: ["Add lesson", "লেসন যোগ করুন"],
  title: ["Lesson title", "লেসনের শিরোনাম"],
  summary: ["Lesson summary (optional)", "লেসনের সারাংশ (ঐচ্ছিক)"],
  url: ["YouTube video link", "YouTube ভিডিওর লিংক"],
  access: ["Who can watch", "কারা দেখতে পারবেন"],
  PUBLIC_DEMO: ["Public demo", "সবার জন্য ডেমো"],
  ENROLLED: ["Enrolled users", "এনরোলড ব্যবহারকারী"],
  up: ["Move up", "উপরে নিন"],
  down: ["Move down", "নিচে নিন"],
  remove: ["Remove lesson", "লেসন সরান"],
  removeConfirm: [
    "Remove this lesson from the draft? Save lessons to apply the removal.",
    "খসড়া থেকে এই লেসন সরাবেন? পরিবর্তন কার্যকর করতে লেসন সংরক্ষণ করুন।",
  ],
  preview: ["Preview video", "ভিডিও দেখুন"],
  close: ["Close preview", "ভিডিও বন্ধ করুন"],
  save: ["Save lessons", "লেসন সংরক্ষণ করুন"],
  saving: ["Saving lessons…", "লেসন সংরক্ষণ হচ্ছে…"],
  saved: ["Lessons saved.", "লেসন সংরক্ষিত হয়েছে।"],
  unsaved: ["Unsaved lesson changes", "লেসনের পরিবর্তন এখনো সংরক্ষিত হয়নি"],
  reload: [
    "Discard draft and reload saved lessons",
    "খসড়া বাদ দিয়ে সংরক্ষিত লেসন আবার দেখুন",
  ],
  discard: [
    "Discard unsaved changes and reload?",
    "অসংরক্ষিত পরিবর্তন বাদ দিয়ে আবার লোড করবেন?",
  ],
  invalid: [
    "Check each lesson title and YouTube link. Use a public or unlisted video with embedding enabled.",
    "প্রতিটি লেসনের শিরোনাম ও YouTube লিংক পরীক্ষা করুন। এমবেড চালু থাকা পাবলিক বা আনলিস্টেড ভিডিও ব্যবহার করুন।",
  ],
  privacy: [
    "YouTube handles playback. Unlisted links can be shared; preview does not guarantee future availability. If playback is unavailable, check the video's privacy and embedding settings.",
    "ভিডিও YouTube থেকে চলে। আনলিস্টেড লিংক শেয়ার করা যায়; ভবিষ্যতেও ভিডিও পাওয়া যাবে এমন নিশ্চয়তা নেই। ভিডিও না চললে সেটির প্রাইভেসি ও এমবেড সেটিংস পরীক্ষা করুন।",
  ],
  count: ["Lessons · demos", "লেসন · ডেমো"],
} as const;
export function getAdminCourseMessages(locale: Locale) {
  return Object.fromEntries(
    Object.entries(copy).map(([key, pair]) => [
      key,
      pair[locale === "bn" ? 1 : 0],
    ]),
  ) as { [K in keyof typeof copy]: string };
}
