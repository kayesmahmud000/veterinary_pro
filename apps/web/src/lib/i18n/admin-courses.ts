import type { Locale } from "./locale";
const copy = {
  courses: ["Courses", "কোর্সসমূহ"],
  intro: [
    "Create a free YouTube course, add video lessons, then publish it when it is ready.",
    "ফ্রি YouTube কোর্স তৈরি করুন, ভিডিও লেসন যোগ করুন, তারপর প্রস্তুত হলে প্রকাশ করুন।",
  ],
  createHeading: ["Add a course", "কোর্স যোগ করুন"],
  createAndContinue: ["Create course and add videos", "কোর্স তৈরি করে ভিডিও যোগ করুন"],
  draftHint: [
    "This saves a draft course. Next, add YouTube video links and choose who can watch each lesson.",
    "কোর্সটি খসড়া হিসেবে সংরক্ষিত হবে। এরপর লেসনের YouTube লিংক দিন ও কারা দেখতে পারবেন তা বেছে নিন।",
  ],
  listHeading: ["Manage existing courses", "আগের কোর্স পরিচালনা করুন"],
  backCourses: ["Back to courses", "কোর্সের তালিকায় ফিরুন"],
  courseDetails: ["Course details and publication", "কোর্সের তথ্য ও প্রকাশনা"],
  emptyCourses: ["No matching courses yet. Create a course using the form above.", "কোনো কোর্স পাওয়া যায়নি। উপরের ফর্ম থেকে কোর্স তৈরি করুন।"],
  invalidDetails: ["Check the course title, slug and description.", "কোর্সের শিরোনাম, স্লাগ ও বিবরণ পরীক্ষা করুন।"],
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
