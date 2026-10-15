"use client";
import { useEffect, useRef, useState } from "react";
import { loadYouTube, youtubeEmbedUrl } from "@/lib/courses/youtube-player";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { getCourseMessages } from "@/lib/i18n/courses";
export function YouTubePlayer({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  const { locale } = useAuth(),
    t = getCourseMessages(locale),
    host = useRef<HTMLDivElement>(null),
    [status, setStatus] = useState("loading"),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let active = true,
      player: { destroy: () => void } | undefined;
    setStatus("loading");
    const readyTimer = setTimeout(() => {
      if (active) setStatus("error-network");
    }, 15000);
    const frame = document.createElement("iframe");
    frame.src = youtubeEmbedUrl(videoId, window.location.origin, locale);
    frame.title = title;
    frame.className = "aspect-video min-h-[200px] w-full rounded-xl border-0";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allow = "encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.setAttribute("data-youtube-player", "");
    container.replaceChildren(frame);
    void loadYouTube()
      .then((api) => {
        if (active)
          player = new api.Player(frame, {
            events: {
              onReady: () => {
                clearTimeout(readyTimer);
                if (active) setStatus("ready");
              },
              onError: (event) => {
                clearTimeout(readyTimer);
                if (active) setStatus(`error-${event.data}`);
              },
            },
          });
      })
      .catch(() => {
        if (active) setStatus("error-network");
      });
    return () => {
      active = false;
      clearTimeout(readyTimer);
      player?.destroy();
      container.replaceChildren();
    };
  }, [videoId, title, locale, revision]);
  return (
    <section className="space-y-3" aria-label={title} data-course-player>
      <div ref={host} />
      {status === "loading" && <p role="status">{t.playerLoading}</p>}
      {status.startsWith("error") && (
        <div
          role="alert"
          className="rounded-xl border border-solid border-line p-4"
        >
          <p>{status === "error-153" ? t.referrerError : t.playerError}</p>
          <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
            {t.retry}
          </Button>
        </div>
      )}
      <p className="text-sm text-muted">{t.playerPrivacy}</p>
    </section>
  );
}
