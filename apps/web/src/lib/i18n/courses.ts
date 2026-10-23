import type { Locale } from "./locale";
const copy = {
  manageCourses: ["Manage courses", "কোর্স পরিচালনা করুন"],
  manageCourse: ["Manage this course", "এই কোর্স পরিচালনা করুন"],
  administrator: [
    "You are viewing this course as an administrator. Manage its details and lessons without enrolling.",
    "আপনি প্রশাসক হিসেবে কোর্সটি দেখছেন। এনরোল না করেই এর তথ্য ও লেসন পরিচালনা করুন।",
  ],
  discover: ["Learn something you can put into practice", "শিখুন, কাজে লাগান"],
  videoCourse: ["Video course", "ভিডিও কোর্স"],
  searchHint: [
    "Find practical lessons for your next step.",
    "আপনার প্রয়োজনের ব্যবহারিক লেসন খুঁজে নিন।",
  ],
  searchLabel: ["Course name or topic", "কোর্সের নাম বা বিষয়"],
  searchPlaceholder: ["What would you like to learn?", "আপনি কী শিখতে চান?"],
  clear: ["Clear search", "খোঁজা মুছুন"],
  allCourses: ["Explore our courses", "আমাদের কোর্সগুলো দেখুন"],
  searchResults: ["Search results", "খোঁজার ফলাফল"],
  coursesOnPage: ["courses on this page", "টি কোর্স এই পাতায়"],
  noResults: ["No matching courses", "মিল আছে এমন কোর্স পাওয়া যায়নি"],
  noResultsHint: [
    "Try another word or browse all courses.",
    "অন্য শব্দ দিয়ে খুঁজুন বা সব কোর্স দেখুন।",
  ],
  checkBack: [
    "New lessons will appear here when they are available.",
    "নতুন লেসন পাওয়া গেলে এখানে দেখা যাবে।",
  ],
  pagination: ["Course pages", "কোর্সের পাতা"],
  overview: ["About this course", "এই কোর্স সম্পর্কে"],
  curriculum: ["Your learning path", "আপনার শেখার ধাপ"],
  learnAtPace: ["Learn at your own pace", "নিজের সুবিধামতো শিখুন"],
  publicPreview: [
    "Preview a lesson before you enroll.",
    "এনরোল করার আগে একটি ডেমো লেসন দেখুন।",
  ],
  openLesson: ["Open lesson", "লেসন খুলুন"],
  unlockLesson: ["Unlock lesson", "লেসন চালু করুন"],
  selectedLesson: ["Selected lesson", "নির্বাচিত লেসন"],
  enrollmentHeading: ["Start learning for free", "বিনামূল্যে শেখা শুরু করুন"],
  enrollmentAccount: [
    "Enroll using your signed-in account",
    "আপনার লগইন করা অ্যাকাউন্ট দিয়ে এনরোল করুন",
  ],
  enrollmentInfo: [
    "Your account is all you need. No extra personal details are required.",
    "আপনার অ্যাকাউন্টই যথেষ্ট। বাড়তি ব্যক্তিগত তথ্যের প্রয়োজন নেই।",
  ],
  enrollmentSignIn: [
    "Sign in or create an account, then confirm your free enrollment.",
    "লগইন করুন বা অ্যাকাউন্ট তৈরি করুন, তারপর ফ্রি এনরোলমেন্ট নিশ্চিত করুন।",
  ],
  enrollmentError: [
    "Enrollment could not be confirmed. Try again; an existing enrollment will be reused.",
    "এনরোলমেন্ট নিশ্চিত করা যায়নি। আবার চেষ্টা করুন; আগের এনরোলমেন্ট থাকলে সেটিই ব্যবহার হবে।",
  ],
  membershipError: [
    "We could not check your enrollment. Try again to continue.",
    "আপনার এনরোলমেন্ট যাচাই করা যায়নি। চালিয়ে যেতে আবার চেষ্টা করুন।",
  ],
  currentLesson: ["Now learning", "এখন শিখছেন"],
  available: ["Ready to watch", "দেখার জন্য প্রস্তুত"],
  libraryIntro: [
    "Your courses, ready whenever you are. Choose a course to start learning.",
    "আপনার সুবিধামতো সময়ে শিখুন। শুরু করতে একটি কোর্স বেছে নিন।",
  ],
  lessonNavigation: ["Lesson navigation", "লেসন পরিবর্তন"],
  backLibrary: ["Back to my courses", "আমার কোর্সে ফিরুন"],
  previewHeading: ["Course preview", "কোর্সের ডেমো"],

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
