"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import {
  courseThumbnailFileError,
  type CourseThumbnailUploadResult,
} from "@vetralink/shared-types";
import type { Locale } from "@/lib/i18n/locale";
import {
  getImageUploadMessages,
  imageUploadError,
} from "@/lib/i18n/image-upload";
import { Button } from "@/components/ui/button";
export interface ImageUploadState {
  busy: boolean;
  dirty: boolean;
  blocked: boolean;
}
interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  upload: (
    file: File,
    options: { signal: AbortSignal; onProgress: (percent: number) => void },
  ) => Promise<CourseThumbnailUploadResult>;
  onStateChange: (state: ImageUploadState) => void;
  disabled?: boolean;
  locale: Locale;
  label: string;
}
type State = {
  file: File | null;
  preview: string;
  phase: "idle" | "uploading" | "success" | "error";
  progress: number;
  error: string;
};
const initial: State = {
  file: null,
  preview: "",
  phase: "idle",
  progress: 0,
  error: "",
};
export function ImageUpload({
  value,
  onChange,
  upload,
  onStateChange,
  disabled,
  locale,
  label,
}: Props) {
  const t = getImageUploadMessages(locale),
    [state, setState] = useState<State>(initial),
    input = useRef<HTMLInputElement>(null),
    generation = useRef(0),
    controller = useRef<AbortController>(),
    preview = useRef("");
  const commit = (next: State) => {
    setState(next);
    onStateChange({
      busy: next.phase === "uploading",
      dirty: !!next.file,
      blocked: !!next.file,
    });
  };
  const stop = () => {
    generation.current++;
    controller.current?.abort();
    if (preview.current) {
      URL.revokeObjectURL(preview.current);
      preview.current = "";
    }
  };
  useLayoutEffect(() => {
    onStateChange({ busy: false, dirty: false, blocked: false });
    return () => {
      generation.current++;
      controller.current?.abort();
      if (preview.current) URL.revokeObjectURL(preview.current);
    };
  }, [onStateChange]);
  const discard = () => {
    stop();
    commit(initial);
    if (input.current) input.current.value = "";
  };
  async function choose(files: File[]) {
    if (disabled || files.length === 0) return;
    stop();
    const file = files[0];
    const error =
      files.length !== 1
        ? "THUMBNAIL_UNSUPPORTED"
        : courseThumbnailFileError(file);
    if (error) {
      commit({ ...initial, file, phase: "error", error });
      return;
    }
    const local = URL.createObjectURL(file);
    preview.current = local;
    const current = generation.current,
      abort = new AbortController();
    controller.current = abort;
    commit({
      file,
      preview: local,
      phase: "uploading",
      progress: 0,
      error: "",
    });
    try {
      const result = await upload(file, {
        signal: abort.signal,
        onProgress: (progress) => {
          if (current === generation.current && !abort.signal.aborted)
            setState((s) => ({ ...s, progress }));
        },
      });
      if (current !== generation.current || abort.signal.aborted) return;
      onChange(result.url);
      URL.revokeObjectURL(local);
      preview.current = "";
      commit({ ...initial, phase: "success" });
    } catch (error) {
      if (current !== generation.current || abort.signal.aborted) return;
      commit({
        file,
        preview: local,
        phase: "error",
        progress: 0,
        error: error instanceof Error ? error.message : "UNAVAILABLE",
      });
    }
  }
  const busy = state.phase === "uploading",
    src = state.preview || value;
  return (
    <div
      data-image-upload
      data-upload-phase={state.phase}
      role="group"
      aria-labelledby="course-thumbnail-label"
      className="space-y-3"
    >
      <label
        id="course-thumbnail-label"
        htmlFor="course-thumbnailUrl"
        className="block font-semibold"
      >
        {label}
      </label>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void choose(Array.from(event.dataTransfer.files));
        }}
        className="space-y-4 rounded-xl border-2 border-dashed border-line bg-paper p-4"
      >
        {src ? (
          <div className="aspect-video overflow-hidden rounded-lg bg-white">
            <img
              data-thumbnail-preview
              src={src}
              alt={t.preview}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <ImagePlus size={32} aria-hidden="true" className="text-muted" />
        )}
        <p id="course-thumbnail-hint" className="text-sm text-muted">
          {t.drop}
        </p>
        <input
          ref={input}
          id="course-thumbnailUrl"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={disabled}
          aria-describedby={`course-thumbnail-hint${state.error ? " course-thumbnail-error" : ""}`}
          aria-invalid={!!state.error}
          onChange={(event) => {
            void choose(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            {src ? t.change : t.choose}
          </Button>
          {busy && (
            <Button
              data-thumbnail-cancel
              type="button"
              variant="outline"
              onClick={discard}
            >
              {t.cancel}
            </Button>
          )}
          {state.phase === "error" && (
            <>
              <Button
                data-thumbnail-retry
                type="button"
                disabled={
                  disabled ||
                  !state.file ||
                  !!courseThumbnailFileError(state.file)
                }
                onClick={() => state.file && void choose([state.file])}
              >
                {t.retry}
              </Button>
              <Button
                data-thumbnail-discard
                type="button"
                variant="outline"
                onClick={discard}
              >
                {t.discard}
              </Button>
            </>
          )}
          {(src || state.file) && (
            <Button
              data-thumbnail-remove
              type="button"
              variant="ghost"
              className="w-11 shrink-0 bg-red-50 px-0 text-red-600 hover:bg-red-100 hover:text-red-700 focus-visible:outline-red-600"
              aria-label={t.remove}
              title={t.remove}
              disabled={disabled}
              onClick={() => {
                discard();
                onChange(null);
              }}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
        </div>
        {busy && (
          <div role="status" className="space-y-2 text-sm">
            <p>{state.progress < 100 ? t.uploading : t.processing}</p>
            <progress
              aria-label={t.uploading}
              value={state.progress}
              max={100}
              className="h-2 w-full accent-green"
            />
          </div>
        )}
        {state.phase === "success" && (
          <p role="status" className="text-sm text-green">
            {t.success}
          </p>
        )}
        {state.error && (
          <p
            id="course-thumbnail-error"
            role="alert"
            className="text-sm text-red-700"
          >
            {imageUploadError(state.error, t)}
          </p>
        )}
      </div>
    </div>
  );
}
