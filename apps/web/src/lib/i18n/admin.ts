import type { Locale } from "./locale";

const en = {
  title: "Admin dashboard",
  superTitle: "Super Admin dashboard",
  intro: "Review applications and monitor platform subscriptions.",
  overview: "Subscription overview",
  snapshot: "Snapshot · Dhaka time",
  loading: "Loading…",
  unavailable: "This section is unavailable. Please try again.",
  retry: "Try again",
  recent: "Recent pending applications",
  recentBody: "Up to five recent applications awaiting review.",
  empty: "No pending applications to review.",
  review: "Review application",
  pending: "View pending applications",
  tools: "Administration",
  access: "Administrative access",
  accessBody: "Manage Admin and Super Admin access.",
  counts: {
    totalSubscriptionsCount: "Total subscriptions",
    activeSubscriptionsCount: "Active",
    activePayingSubscriptionsCount: "Active paying",
    trialingSubscriptionsCount: "Trialing",
    pastDueSubscriptionsCount: "Past due",
    canceledSubscriptionsCount: "Canceled",
    expiredSubscriptionsCount: "Expired",
  },
};
const bn: typeof en = {
  title: "অ্যাডমিন ড্যাশবোর্ড",
  superTitle: "সুপার অ্যাডমিন ড্যাশবোর্ড",
  intro: "আবেদন পর্যালোচনা করুন এবং প্ল্যাটফর্মের সাবস্ক্রিপশন দেখুন।",
  overview: "সাবস্ক্রিপশনের সারসংক্ষেপ",
  snapshot: "তথ্যের সময় · ঢাকা সময়",
  loading: "লোড হচ্ছে…",
  unavailable: "এই অংশের তথ্য পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।",
  retry: "আবার চেষ্টা করুন",
  recent: "সাম্প্রতিক অপেক্ষমাণ আবেদন",
  recentBody: "পর্যালোচনার অপেক্ষায় থাকা সর্বশেষ পাঁচটি পর্যন্ত আবেদন।",
  empty: "পর্যালোচনার জন্য কোনো অপেক্ষমাণ আবেদন নেই।",
  review: "আবেদন পর্যালোচনা",
  pending: "অপেক্ষমাণ আবেদন দেখুন",
  tools: "প্রশাসন",
  access: "প্রশাসনিক প্রবেশাধিকার",
  accessBody: "অ্যাডমিন ও সুপার অ্যাডমিনের প্রবেশাধিকার পরিচালনা করুন।",
  counts: {
    totalSubscriptionsCount: "মোট সাবস্ক্রিপশন",
    activeSubscriptionsCount: "সক্রিয়",
    activePayingSubscriptionsCount: "সক্রিয় অর্থপ্রদানকারী",
    trialingSubscriptionsCount: "পরীক্ষামূলক",
    pastDueSubscriptionsCount: "বকেয়া",
    canceledSubscriptionsCount: "বাতিল",
    expiredSubscriptionsCount: "মেয়াদোত্তীর্ণ",
  },
};
export function getAdminMessages(locale: Locale) {
  return locale === "bn" ? bn : en;
}
