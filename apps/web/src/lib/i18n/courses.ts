import type { Locale } from "./locale";
const copy = {
  courses: ["Courses", "কোর্স"],
  intro: [
    "Practical video lessons. Watch a free demo, then enroll free to learn at your own pace.",
    "ব্যবহারিক ভিডিও লেসন। ফ্রি ডেমো দেখুন, তারপর বিনামূল্যে এনরোল করে নিজের সুবিধামতো শিখুন।",
  ],
  free: ["Free enrollment", "ফ্রি এনরোলমেন্ট"],
  search: ["Search courses", "কোর্স খুঁজুন"],
  apply: ["Search", "খুঁজুন"],
  empty: ["No courses to show yet.", "এখনো দেখানোর মতো কোর্স নেই।"],
  loading: ["Loading…", "লোড হচ্ছে…"],
  retry: ["Try again", "আবার চেষ্টা করুন"],
  error: [
    "This content could not be loaded. Please try again.",
    "তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।",
  ],
  missing: [
    "This course or lesson is unavailable.",
    "এই কোর্স বা লেসন পাওয়া যাচ্ছে না।",
  ],
  details: ["Explore course", "কোর্স দেখুন"],
  lessons: ["Lessons", "লেসন"],
  demo: ["Public demo", "সবার জন্য ডেমো"],
  enrolled: ["Enrollment required", "এনরোলমেন্ট প্রয়োজন"],
  watchDemo: ["Watch demo", "ডেমো দেখুন"],
  enroll: ["Enroll free", "ফ্রি এনরোল করুন"],
  enrolling: ["Enrolling…", "এনরোল হচ্ছে…"],
  continue: ["Continue course", "কোর্স চালিয়ে যান"],
  library: ["My courses", "আমার কোর্স"],
  browse: ["Browse courses", "কোর্সগুলো দেখুন"],
  back: ["Back to course", "কোর্সে ফিরুন"],
  next: ["Next", "পরবর্তী"],
  previous: ["Previous", "আগের"],
  libraryEmpty: [
    "You have not enrolled in a course yet.",
    "আপনি এখনো কোনো কোর্সে এনরোল করেননি।",
  ],
  locked: [
    "Enroll free to watch the course lessons.",
    "কোর্সের লেসন দেখতে ফ্রি এনরোল করুন।",
  ],
  playerLoading: ["Connecting to YouTube…", "YouTube-এর সঙ্গে সংযোগ হচ্ছে…"],
  playerError: [
    "This video cannot play here right now. It may be unavailable, private, restricted, or blocked by your connection. Retry or select another lesson.",
    "ভিডিওটি এখানে এখন চালানো যাচ্ছে না। এটি বন্ধ, প্রাইভেট, সীমাবদ্ধ বা সংযোগে বাধাপ্রাপ্ত হতে পারে। আবার চেষ্টা করুন বা অন্য লেসন বেছে নিন।",
  ],
  referrerError: [
    "YouTube could not identify this site. Retry; if this continues, contact support.",
    "YouTube এই সাইট শনাক্ত করতে পারেনি। আবার চেষ্টা করুন; সমস্যা থাকলে সহায়তা নিন।",
  ],
  playerPrivacy: [
    "Playback is provided by YouTube, which receives connection and playback data. Its branding, links and recommendations remain available. Unlisted video links can be shared.",
    "ভিডিও YouTube থেকে চলে; সংযোগ ও ভিডিও দেখার তথ্য YouTube পায়। সেটির ব্র্যান্ডিং, লিংক ও সাজেশন থাকবে। আনলিস্টেড ভিডিওর লিংক শেয়ার করা যায়।",
  ],
  noPayment: [
    "No payment or subscription is required for this course.",
    "এই কোর্সে কোনো মূল্য বা সাবস্ক্রিপশন লাগবে না।",
  ],
  saved: ["Enrollment confirmed.", "এনরোলমেন্ট নিশ্চিত হয়েছে।"],
  closeDemo: ["Close demo", "ডেমো বন্ধ করুন"],
  outOf: ["lessons", "টি লেসন"],
} as const;
export function getCourseMessages(locale: Locale) {
  return Object.fromEntries(
    Object.entries(copy).map(([key, value]) => [
      key,
      value[locale === "bn" ? 1 : 0],
    ]),
  ) as { [K in keyof typeof copy]: string };
}
