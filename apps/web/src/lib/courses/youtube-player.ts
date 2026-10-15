type Player = { destroy: () => void };
type YouTube = {
  Player: new (
    element: HTMLIFrameElement,
    options: {
      events: {
        onReady: () => void;
        onError: (event: { data: number }) => void;
      };
    },
  ) => Player;
};
declare global {
  interface Window {
    YT?: YouTube;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let pending: Promise<YouTube> | undefined;
export function youtubeEmbedUrl(
  videoId: string,
  origin: string,
  locale: string,
): string {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("Invalid video ID");
  const site = new URL(origin);
  if (
    !["https:", "http:"].includes(site.protocol) ||
    site.username ||
    site.password ||
    site.origin !== origin
  )
    throw new Error("Invalid origin");
  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  url.search = new URLSearchParams({
    autoplay: "0",
    controls: "1",
    playsinline: "1",
    rel: "0",
    enablejsapi: "1",
    origin,
    hl: locale === "bn" ? "bn" : "en",
  }).toString();
  return url.toString();
}
export function loadYouTube(): Promise<YouTube> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;
  pending = new Promise<YouTube>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.referrerPolicy = "strict-origin-when-cross-origin";
    const previous = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(fail, 12000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      pending = undefined;
      window.onYouTubeIframeAPIReady = previous;
      reject(new Error("YouTube unavailable"));
    }
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      window.onYouTubeIframeAPIReady = previous;
      try {
        previous?.();
      } finally {
        if (window.YT?.Player) resolve(window.YT);
        else fail();
      }
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return pending;
}
