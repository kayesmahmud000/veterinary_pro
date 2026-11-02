import { Injectable } from "@nestjs/common";
import { EnvService } from "../../config";

const TTL = 10 * 60_000;
const FAILURE_TTL = 60_000;
const MAX_BODY = 1024 * 1024;
const MAX_SECONDS = 2147483647;

export function parseYouTubeDuration(value: string): number | null {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value,
  );
  if (!match || !match.slice(1).some(Boolean) || value.endsWith("T"))
    return null;
  const seconds =
    Number(match[1] ?? 0) * 86400 +
    Number(match[2] ?? 0) * 3600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0);
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= MAX_SECONDS
    ? seconds
    : null;
}

type Entry = { seconds: number | null; expiresAt: number };
type Batch = {
  values: Map<string, number | null>;
  failures: Set<string>;
  cooldown: boolean;
};

/** Optional metadata only: no course, user or entitlement state is cached here. */
@Injectable()
export class YouTubeDurationService {
  private readonly cache = new Map<string, Entry>();
  private readonly inFlight = new Map<string, Promise<void>>();
  private activeBatches = 0;
  private starts: number[] = [];
  private cooldownUntil = 0;

  constructor(private readonly env: EnvService) {}

  async lookup(
    videoIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    const result = new Map<string, number>();
    const key = this.env.youtubeDataApiKey;
    if (!key) return result;
    const ids = [
      ...new Set(videoIds.filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id))),
    ].slice(0, 100);
    this.purgeExpired();
    const waiting = new Set<Promise<void>>();
    const missing: string[] = [];
    for (const id of ids) {
      if (this.touch(id)) continue;
      const pending = this.inFlight.get(id);
      if (pending) waiting.add(pending);
      else missing.push(id);
    }
    const now = Date.now();
    this.starts = this.starts.filter((start) => start > now - 60_000);
    for (let offset = 0; offset < missing.length; offset += 50) {
      if (
        this.activeBatches >= 2 ||
        this.starts.length >= 30 ||
        now < this.cooldownUntil
      )
        break;
      const batch = missing.slice(offset, offset + 50);
      this.activeBatches++;
      this.starts.push(now);
      // Defer execution until every source has its in-flight entry installed.
      const job = Promise.resolve()
        .then(() => this.fetchBatch(batch, key))
        .finally(() => {
          this.activeBatches--;
          for (const id of batch) this.inFlight.delete(id);
        });
      for (const id of batch) this.inFlight.set(id, job);
      waiting.add(job);
    }
    if (waiting.size) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.all(waiting),
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 2000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
    for (const id of ids) {
      const entry = this.touch(id);
      if (entry?.seconds) result.set(id, entry.seconds);
    }
    return result;
  }

  private touch(id: string): Entry | undefined {
    const entry = this.cache.get(id);
    if (!entry) return;
    this.cache.delete(id);
    if (entry.expiresAt <= Date.now()) return;
    this.cache.set(id, entry);
    return entry;
  }

  private purgeExpired() {
    const now = Date.now();
    for (const [id, entry] of this.cache)
      if (entry.expiresAt <= now) this.cache.delete(id);
  }

  private store(id: string, seconds: number | null, ttl: number) {
    this.purgeExpired();
    this.cache.delete(id);
    this.cache.set(id, { seconds, expiresAt: Date.now() + ttl });
    while (this.cache.size > 1000)
      this.cache.delete(this.cache.keys().next().value!);
  }

  private async fetchBatch(ids: string[], key: string): Promise<void> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const batch = await Promise.race([
        this.request(ids, key, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("Duration lookup timed out"));
          }, 1500);
        }),
      ]);
      if (batch.cooldown) this.cooldownUntil = Date.now() + TTL;
      for (const id of ids)
        this.store(
          id,
          batch.values.get(id) ?? null,
          batch.cooldown || batch.failures.has(id) ? FAILURE_TTL : TTL,
        );
    } catch {
      // Provider errors/response bodies can contain credentials: never log them.
      for (const id of ids) this.store(id, null, FAILURE_TTL);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  private async request(
    ids: string[],
    key: string,
    signal: AbortSignal,
  ): Promise<Batch> {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "contentDetails,snippet");
    url.searchParams.set(
      "fields",
      "items(id,contentDetails/duration,snippet/liveBroadcastContent)",
    );
    url.searchParams.set("id", ids.join(","));
    const response = await fetch(url, {
      headers: { "X-Goog-Api-Key": key, Accept: "application/json" },
      signal,
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      // A fixed, validated query can also return 400 for invalid/expired keys.
      if ([400, 401, 403, 429].includes(response.status))
        return { values: new Map(), failures: new Set(ids), cooldown: true };
      throw new Error("Duration lookup unavailable");
    }
    if (
      Number(response.headers.get("content-length")) > MAX_BODY ||
      !response.body
    ) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error("Invalid duration response");
    }
    const reader = response.body.getReader();
    const cancel = () => {
      void reader.cancel().catch(() => undefined);
    };
    signal.addEventListener("abort", cancel, { once: true });
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      if (signal.aborted) throw new Error("Duration lookup expired");
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY) {
          cancel();
          throw new Error("Invalid duration response");
        }
        chunks.push(value);
      }
    } finally {
      signal.removeEventListener("abort", cancel);
      reader.releaseLock();
    }
    if (signal.aborted) throw new Error("Duration lookup expired");
    const raw: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      !raw ||
      typeof raw !== "object" ||
      !Array.isArray((raw as { items?: unknown }).items)
    )
      throw new Error("Invalid duration response");
    const values = new Map<string, number | null>();
    const failures = new Set<string>();
    const requested = new Set(ids);
    for (const item of (raw as { items: unknown[] }).items) {
      if (!item || typeof item !== "object") continue;
      const record = item as {
        id?: unknown;
        contentDetails?: { duration?: unknown };
        snippet?: { liveBroadcastContent?: unknown };
      };
      if (typeof record.id !== "string" || !requested.has(record.id)) continue;
      if (
        record.snippet?.liveBroadcastContent === "live" ||
        record.snippet?.liveBroadcastContent === "upcoming"
      )
        continue;

      const seconds =
        record.snippet?.liveBroadcastContent === "none" &&
        typeof record.contentDetails?.duration === "string"
          ? parseYouTubeDuration(record.contentDetails.duration)
          : null;
      if (seconds == null) failures.add(record.id);
      else values.set(record.id, seconds);
    }
    return { values, failures, cooldown: false };
  }
}
