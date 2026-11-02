import { EnvService } from "../../config";
import {
  YouTubeDurationService,
  parseYouTubeDuration,
} from "./youtube-duration.service";

const video = (n: number) => `vid${String(n).padStart(8, "0")}`;
const response = (ids: string[], duration = "PT12M35S") =>
  Response.json({
    items: ids.map((id) => ({
      id,
      contentDetails: { duration },
      snippet: { liveBroadcastContent: "none" },
    })),
  });
const idsFrom = (url: string | URL | Request) =>
  new URL(String(url)).searchParams.get("id")!.split(",");

describe("YouTube durations", () => {
  let fetchMock: jest.SpyInstance, service: YouTubeDurationService;
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-11-02T00:00:00Z") });
    fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => response(idsFrom(url)));
    service = new YouTubeDurationService({
      youtubeDataApiKey: "synthetic-key",
    } as unknown as EnvService);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it.each([
    ["PT12M35S", 755],
    ["PT1H2M3S", 3723],
    ["P1DT2H3M4S", 93784],
    ["PT1S", 1],
    ["PT60S", 60],
  ])("parses %s", (input, expected) =>
    expect(parseYouTubeDuration(input)).toBe(expected),
  );
  it.each([
    "PT0S",
    "PT1.5S",
    "P1M",
    "P1Y",
    "-PT1S",
    "PT",
    "P",
    "P1DT",
    "PT2147483648S",
    "bad",
  ])("rejects %s", (input) => expect(parseYouTubeDuration(input)).toBeNull());
  it("uses the fixed endpoint/header and deduplicates validated IDs", async () => {
    const result = await service.lookup([
      video(1),
      video(1),
      "https://evil.test",
      video(2),
    ]);
    expect([...result.values()]).toEqual([755, 755]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).origin + new URL(url).pathname).toBe(
      "https://www.googleapis.com/youtube/v3/videos",
    );
    expect(new URL(url).searchParams.get("part")).toBe(
      "contentDetails,snippet",
    );
    expect(String(url)).not.toContain("synthetic-key");
    expect(init.headers).toMatchObject({ "X-Goog-Api-Key": "synthetic-key" });
    expect(init.redirect).toBe("error");
  });
  it("does no network work when the key is absent", async () => {
    expect(
      (await new YouTubeDurationService({} as EnvService).lookup([video(1)]))
        .size,
    ).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("chunks at 50 and caps each outline at 100 IDs", async () => {
    expect(
      (await service.lookup(Array.from({ length: 101 }, (_, i) => video(i))))
        .size,
    ).toBe(100);
    expect(fetchMock.mock.calls.map(([url]) => idsFrom(url).length)).toEqual([
      50, 50,
    ]);
  });
  it("ignores unknown response IDs, live/zero/missing videos and preserves valid partial results", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        items: [
          {
            id: video(1),
            contentDetails: { duration: "PT1H" },
            snippet: { liveBroadcastContent: "none" },
          },
          {
            id: video(2),
            contentDetails: { duration: "PT1H" },
            snippet: { liveBroadcastContent: "live" },
          },
          {
            id: video(3),
            contentDetails: { duration: "PT0S" },
            snippet: { liveBroadcastContent: "none" },
          },
          {
            id: video(99),
            contentDetails: { duration: "PT1H" },
            snippet: { liveBroadcastContent: "none" },
          },
        ],
      }),
    );
    expect([
      ...(await service.lookup([video(1), video(2), video(3), video(4)])),
    ]).toEqual([[video(1), 3600]]);
    await service.lookup([video(2), video(4)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("expires positive and confirmed-unavailable cache entries at ten minutes", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ items: [] }));
    await service.lookup([video(1)]);
    await service.lookup([video(1)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(600000);
    expect((await service.lookup([video(1)])).get(video(1))).toBe(755);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(600000);
    await service.lookup([video(1)]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("suppresses transport/malformed responses for 60 seconds without throwing or logging secrets", async () => {
    const log = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    fetchMock.mockRejectedValueOnce(new Error("secret synthetic-key"));
    expect((await service.lookup([video(1)])).size).toBe(0);
    await service.lookup([video(1)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(60000);
    fetchMock.mockResolvedValueOnce(Response.json({ items: "invalid" }));
    expect((await service.lookup([video(1)])).size).toBe(0);
  });
  it.each([400, 401, 403, 429])(
    "cools down all lookups after %s while keeping fresh known hits",
    async (status) => {
      await service.lookup([video(1)]);
      await jest.advanceTimersByTimeAsync(1000);
      fetchMock.mockResolvedValueOnce(new Response("{}", { status }));
      await service.lookup([video(2)]);
      expect([...(await service.lookup([video(1), video(3)]))]).toEqual([
        [video(1), 755],
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(600000);
      expect((await service.lookup([video(3)])).get(video(3))).toBe(755);
    },
  );
  it("coalesces overlapping IDs and returns cached values when both batch slots are occupied", async () => {
    let release!: (r: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = service.lookup([video(1), video(2)]);
    await Promise.resolve();
    const second = service.lookup([video(2), video(3)]);
    await Promise.resolve();
    const third = await service.lookup([video(4)]);
    expect(third.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    release(response([video(1), video(2)]));
    expect((await first).size).toBe(2);
    expect((await second).size).toBe(2);
    expect(fetchMock.mock.calls.map(([url]) => idsFrom(url))).toEqual([
      [video(1), video(2)],
      [video(3)],
    ]);
  });
  it("aborts a hung fetch at 1.5 seconds, never caches a late result and releases its slot", async () => {
    let release!: (r: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const request = service.lookup([video(1)]);
    await jest.advanceTimersByTimeAsync(1500);
    expect((await request).size).toBe(0);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    release(response([video(1)]));
    await jest.advanceTimersByTimeAsync(0);
    expect((await service.lookup([video(1)])).size).toBe(0);
    expect((await service.lookup([video(2)])).get(video(2))).toBe(755);
  });
  it("bounds a hung response body and rejects oversized responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new ReadableStream({ start() {} })),
    );
    const request = service.lookup([video(1)]);
    await jest.advanceTimersByTimeAsync(1500);
    expect((await request).size).toBe(0);
    fetchMock.mockResolvedValueOnce(new Response(" ".repeat(1024 * 1024 + 1)));
    expect((await service.lookup([video(2)])).size).toBe(0);
    fetchMock.mockResolvedValueOnce(
      new Response("{}", {
        headers: { "Content-Length": String(1024 * 1024 + 1) },
      }),
    );
    expect((await service.lookup([video(3)])).size).toBe(0);
  });
  it("skips the 31st batch start in a rolling minute, then admits work after reset", async () => {
    for (let i = 0; i < 30; i++) await service.lookup([video(i)]);
    expect((await service.lookup([video(30)])).size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(30);
    await jest.advanceTimersByTimeAsync(60000);
    expect((await service.lookup([video(30)])).size).toBe(1);
  });
  it("evicts least recently used entries at 1000 and preserves recently read values", async () => {
    for (let i = 0; i < 10; i++)
      await service.lookup(
        Array.from({ length: 100 }, (_, j) => video(i * 100 + j)),
      );
    await service.lookup([video(0)]);
    await service.lookup([video(1000)]);
    const calls = fetchMock.mock.calls.length;
    await service.lookup([video(0)]);
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    await service.lookup([video(1)]);
    expect(fetchMock).toHaveBeenCalledTimes(calls + 1);
  });
  it("keeps valid items when another item's live status is malformed JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        items: [
          {
            id: video(1),
            contentDetails: { duration: "PT1M" },
            snippet: { liveBroadcastContent: "none" },
          },
          {
            id: video(2),
            contentDetails: { duration: "PT1M" },
            snippet: { liveBroadcastContent: { toString: null } },
          },
        ],
      }),
    );
    expect([...(await service.lookup([video(1), video(2)]))]).toEqual([
      [video(1), 60],
    ]);
  });
  it("retries malformed requested items after 60 seconds while retaining valid batch results", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        items: [
          {
            id: video(1),
            contentDetails: { duration: "PT1M" },
            snippet: { liveBroadcastContent: "none" },
          },
          {
            id: video(2),
            contentDetails: { duration: "broken" },
            snippet: { liveBroadcastContent: "none" },
          },
        ],
      }),
    );
    expect([...(await service.lookup([video(1), video(2)]))]).toEqual([
      [video(1), 60],
    ]);
    await jest.advanceTimersByTimeAsync(60000);
    expect([...(await service.lookup([video(1), video(2)]))]).toEqual([
      [video(1), 60],
      [video(2), 755],
    ]);
    expect(fetchMock.mock.calls.map(([url]) => idsFrom(url))).toEqual([
      [video(1), video(2)],
      [video(2)],
    ]);
  });
});
