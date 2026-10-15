import {
  adminPartUrlSchema,
  adminUploadSchema,
  type AdminUpload,
} from "@vetralink/shared-types";
import { workspaceRequest } from "./client";
export function uploadContentType(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return (
    (
      {
        pdf: "application/pdf",
        epub: "application/epub+zip",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
        mkv: "video/x-matroska",
      } as Record<string, string>
    )[ext ?? ""] ?? file.type
  );
}
export async function transferAdminFile(
  session: AdminUpload,
  file: File,
  progress: (value: number) => void,
  signal: AbortSignal,
) {
  if (session.state === "UPLOADED") return session;
  if (
    file.name !== session.filename ||
    file.size !== session.fileSizeBytes ||
    uploadContentType(file) !== session.contentType
  )
    throw new Error("INVALID_UPLOAD");
  const parts: Array<{ partNumber: number; etag: string }> = [],
    count = Math.ceil(file.size / session.partSizeBytes);
  for (let index = 0; index < count; index++) {
    if (signal.aborted) throw new Error("UPLOAD_CANCELLED");
    const signed = await workspaceRequest(
      `admin/media/uploads/${session.id}/part-url`,
      adminPartUrlSchema,
      "POST",
      { partNumber: index + 1 },
    );
    if (signed.data && signed.data.partNumber !== index + 1)
      throw new Error("FILE_UPLOAD_FAILED");
    if (!signed.data) throw new Error(signed.code ?? "FILE_UPLOAD_FAILED");
    const response = await fetch(signed.data.url, {
      method: "PUT",
      body: file.slice(
        index * session.partSizeBytes,
        Math.min(file.size, (index + 1) * session.partSizeBytes),
      ),
      credentials: "omit",
      redirect: "error",
      signal,
    });
    const etag = response.headers.get("etag");
    if (!response.ok || !etag) throw new Error("FILE_UPLOAD_FAILED");
    parts.push({ partNumber: index + 1, etag });
    progress(Math.floor(((index + 1) * 100) / count));
  }
  if (signal.aborted) throw new Error("UPLOAD_CANCELLED");
  const result = await workspaceRequest(
    `admin/media/uploads/${session.id}/complete`,
    adminUploadSchema,
    "POST",
    { parts },
  );
  if (!result.data) throw new Error(result.code ?? "FILE_UPLOAD_FAILED");
  return result.data;
}
