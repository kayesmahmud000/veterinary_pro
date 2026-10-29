import {
  courseThumbnailFileError,
  courseThumbnailUploadResultSchema,
  type CourseThumbnailUploadResult,
} from "@vetralink/shared-types";
import { authRequest, withSessionLock } from "../auth/client";
export interface ThumbnailUploadOptions {
  expectedActor: string;
  signal: AbortSignal;
  onProgress: (percent: number) => void;
}
class UploadError extends Error {
  constructor(
    public status: number,
    code: string,
  ) {
    super(code);
  }
}
function transfer(
  file: File,
  options: ThumbnailUploadOptions,
): Promise<CourseThumbnailUploadResult> {
  return new Promise((resolve, reject) => {
    if (options.signal.aborted) {
      reject(new UploadError(0, "UPLOAD_CANCELLED"));
      return;
    }
    const xhr = new XMLHttpRequest();
    const cleanup = () => options.signal.removeEventListener("abort", abort);
    const fail = (status: number, code: string) => {
      cleanup();
      reject(new UploadError(status, code));
    };
    const abort = () => xhr.abort();
    xhr.open("POST", "/api/workspace/admin/course-thumbnails");
    xhr.timeout = 40_000;
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-Workspace-Actor", options.expectedActor);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && !options.signal.aborted)
        options.onProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
    };
    xhr.onload = () => {
      cleanup();
      if (options.signal.aborted) {
        reject(new UploadError(0, "UPLOAD_CANCELLED"));
        return;
      }
      let result: unknown;
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        reject(new UploadError(502, "INVALID_RESPONSE"));
        return;
      }
      const envelope = result as { data?: unknown; code?: unknown };
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new UploadError(
            xhr.status,
            typeof envelope?.code === "string" ? envelope.code : "UNAVAILABLE",
          ),
        );
        return;
      }
      const parsed = courseThumbnailUploadResultSchema.safeParse(
        envelope?.data,
      );
      if (parsed.success) resolve(parsed.data);
      else reject(new UploadError(502, "INVALID_RESPONSE"));
    };
    xhr.onerror = () => fail(503, "UNAVAILABLE");
    xhr.ontimeout = () => fail(503, "TIMEOUT");
    xhr.onabort = () => fail(0, "UPLOAD_CANCELLED");
    options.signal.addEventListener("abort", abort, { once: true });
    const form = new FormData();
    form.append("file", file, file.name);
    xhr.send(form);
  });
}
export async function uploadCourseThumbnail(
  file: File,
  options: ThumbnailUploadOptions,
): Promise<CourseThumbnailUploadResult> {
  const error = courseThumbnailFileError(file);
  if (error) throw new Error(error);
  return withSessionLock(async () => {
    if (options.signal.aborted) throw new Error("UPLOAD_CANCELLED");
    try {
      return await transfer(file, options);
    } catch (error) {
      if (
        !(error instanceof UploadError) ||
        error.status !== 401 ||
        options.signal.aborted
      )
        throw error;
      const refreshed = await authRequest("refresh");
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("vetralink-session-updated"));
      if (!refreshed.ok) throw error;
      const user = refreshed.data.user;
      if (
        !user ||
        `${user.id}:${user.role}:${user.roleVersion ?? 0}` !==
          options.expectedActor
      )
        throw new Error("AUTHORIZATION_CHANGED");
      if (options.signal.aborted) throw new Error("UPLOAD_CANCELLED");
      return transfer(file, options);
    }
  });
}
