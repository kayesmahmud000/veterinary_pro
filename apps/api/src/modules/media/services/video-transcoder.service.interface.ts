export interface VideoProbeResult {
  readonly durationSeconds: number;
  readonly width: number;
  readonly height: number;
  readonly codec: string;
  readonly bitrate?: number;
}

export interface RenditionSpec {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly videoBitrate: string;
  readonly maxRate: string;
  readonly bufSize: string;
  readonly audioBitrate: string;
}

export interface HlsTranscodeParams {
  readonly inputFilePath: string;
  readonly outputDirectory: string;
  readonly segmentDurationSeconds?: number;
  readonly keyInfoFilePath?: string;
}


export interface HlsTranscodeResult {
  readonly masterPlaylistPath: string;
  readonly resolutions: readonly string[];
  readonly durationSeconds: number;
  readonly generatedFiles: readonly string[];
  readonly totalSizeBytes: number;
}

export interface IVideoTranscoderService {
  probeVideo(inputFilePath: string): Promise<VideoProbeResult>;
  transcodeToHls(params: HlsTranscodeParams): Promise<HlsTranscodeResult>;
}

export const VIDEO_TRANSCODER_SERVICE = "VIDEO_TRANSCODER_SERVICE";
