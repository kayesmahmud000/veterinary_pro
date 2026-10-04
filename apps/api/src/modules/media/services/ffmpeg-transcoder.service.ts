import { Injectable, Logger, Optional } from "@nestjs/common";
import { spawn } from "node:child_process";
import { readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import {
  HlsTranscodeParams,
  HlsTranscodeResult,
  IVideoTranscoderService,
  RenditionSpec,
  VideoProbeResult,
} from "./video-transcoder.service.interface";

export type ProcessExecutor = (
  command: string,
  args: string[]
) => Promise<{ stdout: string; stderr: string }>;

export const STANDARD_RENDITIONS: readonly RenditionSpec[] = [
  {
    name: "1080p",
    width: 1920,
    height: 1080,
    videoBitrate: "4500k",
    maxRate: "4800k",
    bufSize: "9000k",
    audioBitrate: "192k",
  },
  {
    name: "720p",
    width: 1280,
    height: 720,
    videoBitrate: "2500k",
    maxRate: "2700k",
    bufSize: "5000k",
    audioBitrate: "128k",
  },
  {
    name: "480p",
    width: 854,
    height: 480,
    videoBitrate: "1200k",
    maxRate: "1300k",
    bufSize: "2400k",
    audioBitrate: "96k",
  },
  {
    name: "360p",
    width: 640,
    height: 360,
    videoBitrate: "800k",
    maxRate: "850k",
    bufSize: "1600k",
    audioBitrate: "64k",
  },
];

@Injectable()
export class FfmpegTranscoderService implements IVideoTranscoderService {
  private readonly logger = new Logger(FfmpegTranscoderService.name);
  private readonly executor: ProcessExecutor;

  constructor(@Optional() customExecutor?: ProcessExecutor) {
    this.executor = customExecutor ?? this.defaultSpawnExecutor;
  }

  private defaultSpawnExecutor: ProcessExecutor = (command, args) => {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args);
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(
            new Error(
              `Command '${command} ${args.join(" ")}' exited with code ${code}: ${stderr}`
            )
          );
        }
      });

      child.on("error", (err) => {
        reject(err);
      });
    });
  };

  public computeLadder(sourceHeight: number): RenditionSpec[] {
    const qualified = STANDARD_RENDITIONS.filter(
      (rendition) => rendition.height <= sourceHeight
    );

    if (qualified.length === 0) {
      // If source height is smaller than 360p, provide at least the 360p profile
      return [STANDARD_RENDITIONS[STANDARD_RENDITIONS.length - 1]!];
    }

    return [...qualified];
  }

  public async probeVideo(inputFilePath: string): Promise<VideoProbeResult> {
    const probeArgs = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      inputFilePath,
    ];

    try {
      const { stdout } = await this.executor("ffprobe", probeArgs);
      const parsed = JSON.parse(stdout) as {
        streams?: Array<{
          codec_type?: string;
          codec_name?: string;
          width?: number;
          height?: number;
          duration?: string;
        }>;
        format?: {
          duration?: string;
          bit_rate?: string;
        };
      };

      const videoStream = parsed.streams?.find((s) => s.codec_type === "video");

      if (!videoStream || !videoStream.width || !videoStream.height) {
        throw new ValidationDomainException(
          "Invalid or corrupted video: no valid video stream found in master asset."
        );
      }

      const durationStr = videoStream.duration ?? parsed.format?.duration;
      const durationSeconds = durationStr ? parseFloat(durationStr) : 0;

      if (durationSeconds <= 0) {
        throw new ValidationDomainException(
          "Invalid video duration: master duration must be greater than zero."
        );
      }

      return {
        durationSeconds: Math.round(durationSeconds),
        width: videoStream.width,
        height: videoStream.height,
        codec: videoStream.codec_name ?? "unknown",
        bitrate: parsed.format?.bit_rate
          ? parseInt(parsed.format.bit_rate, 10)
          : undefined,
      };
    } catch (error) {
      if (error instanceof ValidationDomainException) {
        throw error;
      }
      this.logger.error(
        `ffprobe failed for '${inputFilePath}': ${(error as Error).message}`
      );
      throw new ValidationDomainException(
        `Failed to probe video master: ${(error as Error).message}`
      );
    }
  }

  public async transcodeToHls(
    params: HlsTranscodeParams
  ): Promise<HlsTranscodeResult> {
    const {
      inputFilePath,
      outputDirectory,
      segmentDurationSeconds = 6,
      keyInfoFilePath,
    } = params;

    const probe = await this.probeVideo(inputFilePath);
    const ladder = this.computeLadder(probe.height);

    this.logger.log(
      `Transcoding '${inputFilePath}' (${probe.width}x${probe.height}, ${probe.durationSeconds}s) -> Renditions: [${ladder.map((r) => r.name).join(", ")}]${keyInfoFilePath ? " with AES-128 DRM encryption" : ""}`
    );

    // Build FFmpeg command for multi-bitrate HLS output
    const ffmpegArgs = this.buildFfmpegArgs(
      inputFilePath,
      outputDirectory,
      ladder,
      segmentDurationSeconds,
      keyInfoFilePath
    );

    await this.executor("ffmpeg", ffmpegArgs);

    // Generate Master Playlist (master.m3u8)
    const masterPlaylistPath = join(outputDirectory, "master.m3u8");
    const masterPlaylistContent = this.generateMasterPlaylist(ladder);
    await writeFile(masterPlaylistPath, masterPlaylistContent, "utf8");

    // Enumerate all generated files and calculate total size
    const generatedFiles = await this.collectFiles(outputDirectory);
    let totalSizeBytes = 0;
    for (const relPath of generatedFiles) {
      const fileStat = await stat(join(outputDirectory, relPath));
      totalSizeBytes += fileStat.size;
    }

    return {
      masterPlaylistPath,
      resolutions: ladder.map((r) => r.name),
      durationSeconds: probe.durationSeconds,
      generatedFiles,
      totalSizeBytes,
    };
  }

  private buildFfmpegArgs(
    inputFilePath: string,
    outputDirectory: string,
    ladder: RenditionSpec[],
    segmentDurationSeconds: number,
    keyInfoFilePath?: string
  ): string[] {
    const args: string[] = ["-y", "-i", inputFilePath];

    // Build split filter
    const splitCount = ladder.length;
    const splitTags = ladder.map((_, i) => `[v${i}]`).join("");
    const scaleFilters = ladder
      .map(
        (r, i) =>
          `[v${i}]scale=w=${r.width}:h=${r.height}:force_original_aspect_ratio=decrease,pad=${r.width}:${r.height}:(ow-iw)/2:(oh-ih)/2[v${i}out]`
      )
      .join("; ");

    const filterComplex = `[0:v]split=${splitCount}${splitTags}; ${scaleFilters}`;
    args.push("-filter_complex", filterComplex);

    // Video mappings and encodings
    ladder.forEach((r, i) => {
      args.push(
        "-map",
        `[v${i}out]`,
        `-c:v:${i}`,
        "libx264",
        `-b:v:${i}`,
        r.videoBitrate,
        `-maxrate:v:${i}`,
        r.maxRate,
        `-bufsize:v:${i}`,
        r.bufSize
      );
    });

    // Audio mappings and encodings
    ladder.forEach((r, i) => {
      args.push("-map", "0:a:0?", `-c:a:${i}`, "aac", `-b:a:${i}`, r.audioBitrate);
    });

    // HLS packaging arguments
    args.push(
      "-f",
      "hls",
      "-hls_time",
      segmentDurationSeconds.toString(),
      "-hls_playlist_type",
      "vod",
      "-hls_flags",
      "independent_segments"
    );

    if (keyInfoFilePath) {
      args.push("-hls_key_info_file", keyInfoFilePath);
    }

    args.push(
      "-master_pl_name",
      "master_raw.m3u8",
      "-var_stream_map",
      ladder.map((_, i) => `v:${i},a:${i}`).join(" "),
      "-hls_segment_filename",
      join(outputDirectory, "%v", "segment_%03d.ts"),
      join(outputDirectory, "%v", "index.m3u8")
    );

    return args;
  }

  public generateMasterPlaylist(ladder: RenditionSpec[]): string {
    const lines: string[] = ["#EXTM3U", "#EXT-X-VERSION:3"];

    for (const r of ladder) {
      const vBitrateNum = parseInt(r.videoBitrate.replace("k", ""), 10) * 1000;
      const aBitrateNum = parseInt(r.audioBitrate.replace("k", ""), 10) * 1000;
      const totalBandwidth = vBitrateNum + aBitrateNum;

      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${totalBandwidth},RESOLUTION=${r.width}x${r.height},NAME="${r.name}"`
      );
      lines.push(`${r.name}/index.m3u8`);
    }

    return `${lines.join("\n")}\n`;
  }

  private async collectFiles(
    dir: string,
    baseDir: string = dir
  ): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.collectFiles(fullPath, baseDir);
        results.push(...subFiles);
      } else if (entry.isFile()) {
        results.push(relative(baseDir, fullPath).replace(/\\/g, "/"));
      }
    }

    return results;
  }
}
