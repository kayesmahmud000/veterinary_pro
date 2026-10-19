import type { EditorialDraft } from "@vetralink/shared-types";
export function EditorialText({
  content,
  locale,
  hideHeading = false,
}: {
  content: EditorialDraft;
  locale: "bn" | "en";
  hideHeading?: boolean;
}) {
  const text = content[locale];
  return (
    <article className="min-w-0 max-w-4xl space-y-5 [overflow-wrap:anywhere]">
      {!hideHeading && (
        <>
          <h2 className="!text-2xl">{text.title}</h2>
          <p className="font-semibold">{text.summary}</p>
        </>
      )}
      <div className="whitespace-pre-wrap text-lg leading-8">{text.body}</div>
    </article>
  );
}
