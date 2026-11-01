"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, VideoOff } from "lucide-react";
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
    host = useRef<HTMLDivElement>(null);
  const details = useRef({ title, locale });
  details.current = { title, locale };
  const [status, setStatus] = useState("loading"),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let active = true,
      failed = false,
      player: { destroy: () => void } | undefined;
    setStatus("loading");
    function fail(code: string) {
      if (!active || failed) return;
      failed = true;
      clearTimeout(readyTimer);
      player?.destroy();
      player = undefined;
      container?.replaceChildren();
      setStatus(`error-${code}`);
    }
    const readyTimer = setTimeout(() => fail("network"), 15000);
    const frame = document.createElement("iframe");
    frame.src = youtubeEmbedUrl(
      videoId,
      window.location.origin,
      details.current.locale,
    );
    frame.title = details.current.title;
    frame.className = "absolute inset-0 h-full min-h-[200px] w-full border-0";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allow = "encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.setAttribute("data-youtube-player", "");
    container.replaceChildren(frame);
    void loadYouTube()
      .then((api) => {
        if (active && !failed)
          player = new api.Player(frame, {
            events: {
              onReady: () => {
                if (active && !failed) {
                  clearTimeout(readyTimer);
                  setStatus("ready");
                }
              },
              onError: (event) => fail(String(event.data)),
            },
          });
      })
      .catch(() => fail("network"));
    return () => {
      active = false;
      clearTimeout(readyTimer);
      player?.destroy();
      container.replaceChildren();
    };
  }, [videoId, revision]);
  useEffect(() => {
    const frame = host.current?.querySelector("iframe");
    if (frame) frame.title = title;
  }, [title]);
  return (
    <section className="space-y-3" aria-label={title} data-course-player>
      <div
        className="relative aspect-video min-h-[200px] w-full overflow-hidden rounded-2xl bg-[#101b16] text-white"
        aria-busy={status === "loading"}
      >
        <div ref={host} />
        {status === "loading" && (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#101b16] p-5 text-center"
            role="status"
          >
            <Loader2
              size={32}
              className="motion-safe:animate-spin"
              aria-hidden="true"
            />
            <span>{t.playerLoading}</span>
          </div>
        )}
        {status.startsWith("error") && (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto p-4 text-center sm:p-6"
          >
            <VideoOff
              size={28}
              aria-hidden="true"
              className="shrink-0 text-amber"
            />
            <p className="m-0 max-w-xl text-sm text-white sm:text-base">
              {status === "error-153" ? t.referrerError : t.playerError}
            </p>
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => setRevision((v) => v + 1)}
            >
              {t.retry}
            </Button>
          </div>
        )}
      </div>
      <p className="mb-0 text-xs text-muted">{t.playerPrivacy}</p>
    </section>
  );
}
