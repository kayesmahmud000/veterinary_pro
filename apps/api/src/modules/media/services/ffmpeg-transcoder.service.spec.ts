import { FfmpegTranscoderService } from "./ffmpeg-transcoder.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

describe("FfmpegTranscoderService", () => {
  let service: FfmpegTranscoderService;
  let mockExecutor: jest.Mock;

  beforeEach(() => {
    mockExecutor = jest.fn();
    service = new FfmpegTranscoderService(mockExecutor);
  });

  describe("computeLadder (Ceiling Rule)", () => {
    it("should return full 4-tier ladder (1080p, 720p, 480p, 360p) for 1080p source", () => {
      const ladder = service.computeLadder(1080);
      expect(ladder.map((r) => r.name)).toEqual([
        "1080p",
        "720p",
        "480p",
        "360p",
      ]);
    });

    it("should cap at 720p and omit 1080p for 720p source", () => {
      const ladder = service.computeLadder(720);
      expect(ladder.map((r) => r.name)).toEqual(["720p", "480p", "360p"]);
    });

    it("should cap at 480p for 480p source", () => {
      const ladder = service.computeLadder(480);
      expect(ladder.map((r) => r.name)).toEqual(["480p", "360p"]);
    });

    it("should return 360p for low-resolution source below 360p", () => {
      const ladder = service.computeLadder(240);
      expect(ladder.map((r) => r.name)).toEqual(["360p"]);
    });
  });

  describe("probeVideo", () => {
    it("should parse ffprobe output and return duration, resolution, codec", async () => {
      const mockOutput = {
        streams: [
          {
            codec_type: "video",
            codec_name: "h264",
            width: 1920,
            height: 1080,
            duration: "120.45",
          },
          {
            codec_type: "audio",
            codec_name: "aac",
          },
        ],
        format: {
          duration: "120.45",
          bit_rate: "5000000",
        },
      };

      mockExecutor.mockResolvedValueOnce({
        stdout: JSON.stringify(mockOutput),
        stderr: "",
      });

      const result = await service.probeVideo("mock-input.mp4");

      expect(mockExecutor).toHaveBeenCalledWith(
        "ffprobe",
        expect.arrayContaining(["-print_format", "json", "mock-input.mp4"])
      );
      expect(result.durationSeconds).toBe(120);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.codec).toBe("h264");
      expect(result.bitrate).toBe(5000000);
    });

    it("should throw ValidationDomainException if no video stream found", async () => {
      const mockOutput = {
        streams: [{ codec_type: "audio" }],
      };

      mockExecutor.mockResolvedValueOnce({
        stdout: JSON.stringify(mockOutput),
        stderr: "",
      });

      await expect(service.probeVideo("audio-only.mp3")).rejects.toThrow(
        ValidationDomainException
      );
    });

    it("should throw ValidationDomainException if video duration is zero", async () => {
      const mockOutput = {
        streams: [
          {
            codec_type: "video",
            width: 1920,
            height: 1080,
            duration: "0",
          },
        ],
        format: { duration: "0" },
      };

      mockExecutor.mockResolvedValueOnce({
        stdout: JSON.stringify(mockOutput),
        stderr: "",
      });

      await expect(service.probeVideo("corrupted.mp4")).rejects.toThrow(
        "Invalid video duration: master duration must be greater than zero."
      );
    });
  });

  describe("generateMasterPlaylist", () => {
    it("should generate valid HLS master playlist with stream variants", () => {
      const ladder = service.computeLadder(720);
      const playlist = service.generateMasterPlaylist(ladder);

      expect(playlist).toContain("#EXTM3U");
      expect(playlist).toContain("#EXT-X-VERSION:3");
      expect(playlist).toContain("RESOLUTION=1280x720");
      expect(playlist).toContain("720p/index.m3u8");
      expect(playlist).toContain("RESOLUTION=854x480");
      expect(playlist).toContain("480p/index.m3u8");
      expect(playlist).toContain("RESOLUTION=640x360");
      expect(playlist).toContain("360p/index.m3u8");
      expect(playlist).not.toContain("1080p/index.m3u8");
    });
  });

  describe("transcodeToHls", () => {
    let testTempDir: string;

    beforeEach(async () => {
      testTempDir = path.join(
        os.tmpdir(),
        `transcode-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
      );
      await fs.mkdir(testTempDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await fs.rm(testTempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });

    it("should probe, invoke ffmpeg with ladder, write master.m3u8 and return result", async () => {
      // 1. Mock probe output (1080p video)
      const probeOutput = {
        streams: [
          {
            codec_type: "video",
            codec_name: "h264",
            width: 1920,
            height: 1080,
            duration: "60.0",
          },
        ],
      };

      // Mock executor for ffprobe
      mockExecutor.mockImplementation(async (cmd: string) => {
        if (cmd === "ffprobe") {
          return { stdout: JSON.stringify(probeOutput), stderr: "" };
        }
        if (cmd === "ffmpeg") {
          // Simulate ffmpeg outputting some dummy variant files
          for (const res of ["1080p", "720p", "480p", "360p"]) {
            const resDir = path.join(testTempDir, res);
            await fs.mkdir(resDir, { recursive: true });
            await fs.writeFile(path.join(resDir, "index.m3u8"), "#EXTM3U\n");
            await fs.writeFile(path.join(resDir, "segment_000.ts"), "chunk");
          }
          return { stdout: "", stderr: "" };
        }
        return { stdout: "", stderr: "" };
      });

      const result = await service.transcodeToHls({
        inputFilePath: "master.mp4",
        outputDirectory: testTempDir,
        segmentDurationSeconds: 6,
      });

      expect(mockExecutor).toHaveBeenCalledWith(
        "ffmpeg",
        expect.arrayContaining(["-i", "master.mp4", "-f", "hls"])
      );
      expect(result.resolutions).toEqual(["1080p", "720p", "480p", "360p"]);
      expect(result.durationSeconds).toBe(60);
      expect(result.generatedFiles).toContain("master.m3u8");
      expect(result.totalSizeBytes).toBeGreaterThan(0);
    });

    it("should pass -hls_key_info_file argument to ffmpeg when keyInfoFilePath is provided", async () => {
      const probeOutput = {
        streams: [
          {
            codec_type: "video",
            codec_name: "h264",
            width: 1280,
            height: 720,
            duration: "30.0",
          },
        ],
      };

      mockExecutor.mockImplementation(async (cmd: string) => {
        if (cmd === "ffprobe") {
          return { stdout: JSON.stringify(probeOutput), stderr: "" };
        }
        if (cmd === "ffmpeg") {
          for (const res of ["720p", "480p", "360p"]) {
            const resDir = path.join(testTempDir, res);
            await fs.mkdir(resDir, { recursive: true });
            await fs.writeFile(path.join(resDir, "index.m3u8"), "#EXTM3U\n");
          }
          return { stdout: "", stderr: "" };
        }
        return { stdout: "", stderr: "" };
      });

      const keyInfoPath = path.join(testTempDir, "video.keyinfo");

      await service.transcodeToHls({
        inputFilePath: "master.mp4",
        outputDirectory: testTempDir,
        segmentDurationSeconds: 6,
        keyInfoFilePath: keyInfoPath,
      });

      expect(mockExecutor).toHaveBeenCalledWith(
        "ffmpeg",
        expect.arrayContaining(["-hls_key_info_file", keyInfoPath])
      );
    });
  });
});
