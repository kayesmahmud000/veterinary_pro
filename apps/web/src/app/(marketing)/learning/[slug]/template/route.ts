import { getLocalization } from "@/lib/i18n/server";
import { findGuide } from "@/lib/learning-guides";

export function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const guide = findGuide(params.slug);
  if (!guide)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  const { messages } = getLocalization();
  const headers = messages.resources.articles[guide.index].headers;
  if (!headers.length)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  const csv = `\uFEFF${headers.map((header) => `"${header.replaceAll('"', '""')}"`).join(",")}\r\n${headers.map(() => "").join(",")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vetralink-${guide.slug}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
