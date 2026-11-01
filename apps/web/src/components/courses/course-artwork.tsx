"use client";
import { useState } from "react";
import { BookOpen, Play } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { getCourseMessages } from "@/lib/i18n/courses";

export function CourseArtwork({
  src,
  title,
  priority = false,
  compact = false,
}: {
  src?: string | null;
  title: string;
  priority?: boolean;
  compact?: boolean;
}) {
  const t = getCourseMessages(useAuth().locale);
  const [image, setImage] = useState({ src, status: "loading" });
  const status = image.src === src ? image.status : "loading";
  const visible = !!src && status !== "error";
  return (
    <div
      data-course-artwork
      className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-green to-ink"
    >
      <div
        data-course-artwork-fallback
        className={`absolute inset-0 flex flex-col text-white [&[hidden]]:hidden ${compact ? "items-center justify-center p-2" : "justify-between p-6"}`}
        hidden={visible && status === "ready"}
      >
        <BookOpen
          size={compact ? 20 : 32}
          aria-hidden="true"
          className="text-amber"
        />
        {!compact && (
          <div className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-widest text-amber">
              {t.videoCourse}
            </span>
            <span className="mt-2 block truncate text-lg font-semibold">
              {title}
            </span>
          </div>
        )}
        {!compact && (
          <Play
            size={70}
            aria-hidden="true"
            className="absolute -right-2 top-6 text-white/10"
          />
        )}
      </div>
      {visible && (
        <img
          key={src}
          src={src}
          alt=""
          width={480}
          height={270}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImage({ src, status: "ready" })}
          onError={() => setImage({ src, status: "error" })}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity ${status === "ready" ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
