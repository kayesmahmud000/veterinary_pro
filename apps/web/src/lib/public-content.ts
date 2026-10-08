import type { Locale } from "./i18n/locale";

export type BlogTopic = "records" | "planning" | "care";
export type ArticleCopy = {
  title: string;
  summary: string;
  sections: { title: string; body: string }[];
};
export type BlogPost = {
  slug: string;
  topic: BlogTopic;
  publishedAt: string;
  author: Record<Locale, string>;
  content: Record<Locale, ArticleCopy>;
};
const author = {
  en: "Khamar School editorial team",
  bn: "খামার স্কুলের সম্পাদকীয় দল",
};
export const blogPosts: readonly BlogPost[] = [
  {
    slug: "one-place-for-farm-notes",
    topic: "records",
    publishedAt: "2026-10-08T04:00:00Z",
    author,
    content: {
      en: {
        title: "Give your farm notes a home",
        summary:
          "A consistent place for everyday notes makes it easier to find yesterday's information and hand work over to someone else.",
        sections: [
          {
            title: "Choose a place everyone can find",
            body: "Start with a notebook, a folder of sheets or a shared file that the people doing the work can reach. Write its name and location into your handover routine. Keep the daily record together rather than scattering it across messages.",
          },
          {
            title: "Use the same few fields",
            body: "For each entry, record the date, the animal or group identifier, what was observed or done, and who made the entry. If a number has a unit, write the unit beside it. Mark an unknown detail as unknown so that someone else can distinguish a missing fact from a measured zero.",
          },
          {
            title: "Make corrections visible",
            body: "When a note needs correcting, keep enough context to explain the change. On paper, preserve the original entry and write the correction beside it. In a shared file, keep a dated revision or a short correction note. A useful record explains what changed as well as what it says now.",
          },
          {
            title: "Try a small routine first",
            body: "Begin with one daily task and review the record after a week. Ask the next person to find an entry without your help. Their questions will tell you which headings or identifiers need to be clearer. The free animal-record guide is a useful place to build from.",
          },
        ],
      },
      bn: {
        title: "খামারের নোট রাখার একটি জায়গা ঠিক করুন",
        summary:
          "প্রতিদিনের নোট একই জায়গায় রাখলে আগের তথ্য খোঁজা ও অন্য কাউকে কাজ বুঝিয়ে দেওয়া সহজ হয়।",
        sections: [
          {
            title: "সবাই খুঁজে পাবে এমন জায়গা বেছে নিন",
            body: "যাঁরা কাজ করেন তাঁদের নাগালে থাকা একটি খাতা, শিটের ফোল্ডার বা যৌথ ফাইল দিয়ে শুরু করুন। কাজ হস্তান্তরের নিয়মে এর নাম ও অবস্থান লিখে রাখুন। বিভিন্ন বার্তায় ছড়িয়ে না রেখে দৈনিক রেকর্ড একসঙ্গে রাখুন।",
          },
          {
            title: "কয়েকটি একই ঘর ব্যবহার করুন",
            body: "প্রতিটি নোটে তারিখ, প্রাণী বা দলের পরিচয়, কী দেখা বা করা হয়েছে এবং কে লিখেছেন তা রাখুন। সংখ্যার পাশে একক লিখুন। অজানা তথ্য অজানা হিসেবে চিহ্নিত করুন, যাতে অনুপস্থিত তথ্য ও মেপে পাওয়া শূন্য আলাদা বোঝা যায়।",
          },
          {
            title: "সংশোধনের কারণ বোঝার সুযোগ রাখুন",
            body: "নোট ঠিক করতে হলে কী বদলেছে তা বোঝার মতো তথ্য রাখুন। খাতায় আগের লেখাটি বোঝা যায় এমনভাবে রেখে পাশে সংশোধন লিখুন। যৌথ ফাইলে তারিখসহ সংশোধিত কপি বা ছোট ব্যাখ্যা রাখুন। কাজে লাগার মতো রেকর্ডে বর্তমান তথ্যের সঙ্গে পরিবর্তনও বোঝা যায়।",
          },
          {
            title: "ছোট একটি অভ্যাস দিয়ে শুরু করুন",
            body: "প্রথমে একটি দৈনিক কাজের রেকর্ড রাখুন এবং এক সপ্তাহ পরে দেখুন। আপনার সাহায্য ছাড়া পরের মানুষটিকে একটি নোট খুঁজতে বলুন। তাঁর প্রশ্ন থেকে বোঝা যাবে কোন শিরোনাম বা পরিচয় আরও পরিষ্কার করা দরকার। বিনামূল্যের প্রাণীর রেকর্ড গাইড দিয়ে এগিয়ে যেতে পারেন।",
          },
        ],
      },
    },
  },
  {
    slug: "a-weekly-farm-review",
    topic: "planning",
    publishedAt: "2026-10-08T04:00:00Z",
    author,
    content: {
      en: {
        title: "Make time for a short weekly review",
        summary:
          "Bring notes, unfinished tasks and questions together before another week of farm work begins.",
        sections: [
          {
            title: "Start with the records you already have",
            body: "Gather the week's task notes, production entries and spending records. Check that dates and units are written consistently. If something is missing, list the question instead of filling in a guessed number. Reviewing a small complete set is more useful than rushing to create a large uncertain summary.",
          },
          {
            title: "Separate observations from next actions",
            body: "An observation describes what someone recorded. An action describes what needs to happen next, who will do it and when it should be reviewed. Keep those headings separate so that the person receiving the handover can see both the context and the responsibility.",
          },
          {
            title: "Carry forward only what still needs attention",
            body: "Close tasks that are complete and keep a short list of the remaining ones. Note why a task is waiting, such as a missing record or a question for the owner. Bring that list to the next review rather than repeatedly copying every old note.",
          },
          {
            title: "Keep the review easy to repeat",
            body: "Choose a consistent day and a format that fits the team. A few clear questions are enough: what was recorded, what remains unclear, and what is the next action? Use the same routine next week and adjust it when the team finds a gap.",
          },
        ],
      },
      bn: {
        title: "সপ্তাহে একবার কাজগুলো গুছিয়ে দেখুন",
        summary:
          "খামারের নতুন সপ্তাহ শুরু হওয়ার আগে নোট, অসমাপ্ত কাজ ও প্রশ্নগুলো একসঙ্গে দেখুন।",
        sections: [
          {
            title: "যে রেকর্ড আছে সেগুলো দিয়েই শুরু করুন",
            body: "সপ্তাহের কাজের নোট, উৎপাদনের তথ্য ও খরচের রেকর্ড একসঙ্গে আনুন। তারিখ ও একক একইভাবে লেখা হয়েছে কি না দেখুন। তথ্য না থাকলে আন্দাজে সংখ্যা না বসিয়ে প্রশ্নটি লিখুন। অনিশ্চিত বড় সারাংশের চেয়ে ছোট ও সম্পূর্ণ রেকর্ড পর্যালোচনা বেশি কাজে আসে।",
          },
          {
            title: "পর্যবেক্ষণ ও পরের কাজ আলাদা লিখুন",
            body: "পর্যবেক্ষণে থাকবে কী রেকর্ড করা হয়েছে। পরের কাজে থাকবে কী করতে হবে, কে করবেন ও কখন আবার দেখতে হবে। শিরোনাম আলাদা রাখলে দায়িত্ব গ্রহণকারী মানুষটি তথ্য ও দায়িত্ব দুটোই বুঝতে পারবেন।",
          },
          {
            title: "যা এখনও করতে হবে সেটুকু এগিয়ে নিন",
            body: "শেষ হওয়া কাজ বন্ধ করুন এবং বাকি কাজের ছোট তালিকা রাখুন। কাজ আটকে থাকার কারণ লিখুন—যেমন অনুপস্থিত রেকর্ড বা মালিকের কাছে একটি প্রশ্ন। সব পুরোনো নোট বারবার না লিখে পরের পর্যালোচনায় বাকি কাজের তালিকা আনুন।",
          },
          {
            title: "আবার করা যায় এমন সহজ নিয়ম রাখুন",
            body: "দলের সুবিধা অনুযায়ী নির্দিষ্ট দিন ও ধরন বেছে নিন। কয়েকটি পরিষ্কার প্রশ্ন যথেষ্ট: কী লেখা হয়েছে, কী বোঝা যায়নি এবং পরের কাজ কী? পরের সপ্তাহেও একই নিয়ম ব্যবহার করুন; সমস্যা ধরা পড়লে নিয়মটি ঠিক করুন।",
          },
        ],
      },
    },
  },
  {
    slug: "prepare-an-animal-record-summary",
    topic: "care",
    publishedAt: "2026-10-08T04:00:00Z",
    author,
    content: {
      en: {
        title: "Prepare a useful animal-record summary",
        summary:
          "Organize existing observations and documents so a veterinary conversation has clear context.",
        sections: [
          {
            title: "Begin with the animal's identity",
            body: "Use the same animal identifier as the farm record. Gather the existing identification details and the dates on relevant notes. A summary should make it clear which animal each record belongs to, especially when several animals have similar names.",
          },
          {
            title: "Put the existing notes in time order",
            body: "Arrange dated observations and previous documents from earliest to latest. Preserve who wrote each observation and what was actually recorded. If a time or detail is unknown, say so. This is a way to organize records, not a way to diagnose a condition.",
          },
          {
            title: "Keep documents connected to their source",
            body: "When sharing an existing document or photograph, retain its date and a short description of what it relates to. Keep the original file available. Avoid putting another person's private information in a public post; share the record through the professional's agreed channel.",
          },
          {
            title: "Write down the questions you want to ask",
            body: "A brief list helps you remember which records need explaining and which details you need to confirm. Let the veterinarian interpret clinical information and decide the next care steps. The public website's examples and demo profiles do not provide consultation or treatment services.",
          },
        ],
      },
      bn: {
        title: "প্রাণীর রেকর্ডের একটি প্রয়োজনীয় সারাংশ তৈরি করুন",
        summary:
          "পশুচিকিৎসকের সঙ্গে আলোচনার জন্য বিদ্যমান পর্যবেক্ষণ ও নথিগুলো পরিষ্কারভাবে গুছিয়ে রাখুন।",
        sections: [
          {
            title: "প্রাণীর পরিচয় দিয়ে শুরু করুন",
            body: "খামারের রেকর্ডে থাকা একই প্রাণীর পরিচয় ব্যবহার করুন। পরিচয়ের বিদ্যমান তথ্য ও প্রয়োজনীয় নোটের তারিখ একসঙ্গে রাখুন। একাধিক প্রাণীর নাম কাছাকাছি হলে কোন রেকর্ড কোন প্রাণীর তা সারাংশে পরিষ্কার থাকা দরকার।",
          },
          {
            title: "নোটগুলো সময় অনুযায়ী সাজান",
            body: "তারিখসহ পর্যবেক্ষণ ও আগের নথি পুরোনো থেকে নতুন ক্রমে রাখুন। কে লিখেছেন ও আসলে কী লেখা হয়েছিল তা বজায় রাখুন। সময় বা তথ্য জানা না থাকলে সেটিও লিখুন। এটি রেকর্ড গোছানোর উপায়, রোগ নির্ণয়ের উপায় নয়।",
          },
          {
            title: "নথির সঙ্গে উৎসের তথ্য রাখুন",
            body: "বিদ্যমান নথি বা ছবি ভাগ করে নেওয়ার সময় তারিখ ও এটি কী বিষয়ে তা ছোট করে লিখুন। আসল ফাইলটি রাখুন। প্রকাশ্য লেখায় অন্য মানুষের ব্যক্তিগত তথ্য দেবেন না; পেশাজীবীর সঙ্গে ঠিক করা মাধ্যমে রেকর্ড ভাগ করুন।",
          },
          {
            title: "যে প্রশ্ন করতে চান লিখে রাখুন",
            body: "ছোট একটি তালিকা থেকে মনে রাখতে পারবেন কোন রেকর্ডের ব্যাখ্যা বা কোন তথ্য নিশ্চিত করা দরকার। চিকিৎসাবিষয়ক তথ্যের ব্যাখ্যা ও পরের যত্নের সিদ্ধান্ত পশুচিকিৎসককে নিতে দিন। ওয়েবসাইটের উদাহরণ ও ডেমো পরিচিতি চিকিৎসার পরামর্শ বা সেবা দেয় না।",
          },
        ],
      },
    },
  },
];

export function textQuery(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}
export function findBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
export function filterBlogPosts({
  q,
  topic,
  locale,
}: {
  q?: string | string[];
  topic?: string | string[];
  locale: Locale;
}) {
  const query = textQuery(q).normalize("NFC").toLocaleLowerCase(locale);
  const category =
    typeof topic === "string" && blogPosts.some((post) => post.topic === topic)
      ? topic
      : undefined;
  return blogPosts.filter(
    (post) =>
      (!category || post.topic === category) &&
      (!query ||
        [
          post.content[locale].title,
          post.content[locale].summary,
          ...post.content[locale].sections.map((s) => `${s.title} ${s.body}`),
        ]
          .join(" ")
          .normalize("NFC")
          .toLocaleLowerCase(locale)
          .includes(query)),
  );
}
