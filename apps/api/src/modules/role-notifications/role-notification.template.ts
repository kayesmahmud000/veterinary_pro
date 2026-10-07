export function roleNotificationTemplate(
  locale: string,
  eventType: string,
  role: string,
  link: string,
  reason?: string | null,
) {
  const bn = locale !== "en";
  const submitted = eventType === "ROLE_REQUEST_SUBMITTED";
  const rejected = eventType === "ROLE_REQUEST_REJECTED";
  const approved = eventType === "ROLE_REQUEST_APPROVED";
  const subject = submitted
    ? bn
      ? "নতুন পেশাগত ভূমিকার আবেদন"
      : "New professional-role application"
    : rejected
      ? bn
        ? "আপনার আবেদন গ্রহণ করা হয়নি"
        : "Your application was rejected"
      : approved
        ? bn
          ? "আপনার আবেদন অনুমোদিত হয়েছে"
          : "Your application was approved"
        : bn
          ? "আপনার administrative access বদলেছে"
          : "Your administrative access changed";
  const text = `${subject}\n${role}\n${reason ?? ""}\n${link}`;
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  return {
    subject,
    text,
    html: `<h1>${escape(subject)}</h1><p>${escape(role)}</p>${reason ? `<p>${escape(reason)}</p>` : ""}<p><a href="${escape(link)}">${bn ? "বিস্তারিত দেখুন" : "View details"}</a></p>`,
  };
}
