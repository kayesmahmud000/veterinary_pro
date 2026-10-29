import { Injectable } from "@nestjs/common";
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from "cloudinary";
import { CourseThumbnailUploadResult } from "@vetralink/shared-types";
import { EnvService } from "../../config";
import { WorkflowException } from "../../common/exceptions/domain.exception";
import { ThumbnailStorage } from "./thumbnail-storage.interface";
export function validateCloudinaryResult(
  result: Partial<UploadApiResponse>,
  cloud: string,
  publicId: string,
): CourseThumbnailUploadResult {
  try {
    const url = new URL(result.secure_url ?? "");
    const expected = `/${cloud}/image/upload/v${result.version}/${publicId}.webp`;
    if (
      result.public_id !== publicId ||
      result.format !== "webp" ||
      result.existing ||
      !Number.isSafeInteger(result.version) ||
      Number(result.version) <= 0 ||
      url.protocol !== "https:" ||
      url.host !== "res.cloudinary.com" ||
      url.pathname !== expected ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid provider result");
    return { url: url.href };
  } catch {
    throw new WorkflowException(
      "THUMBNAIL_UNAVAILABLE",
      "Image service is unavailable. Please retry.",
      503,
    );
  }
}
@Injectable()
export class CloudinaryThumbnailStorage implements ThumbnailStorage {
  constructor(private readonly env: EnvService) {}
  async put(
    publicId: string,
    body: Buffer,
    _contentType: "image/webp",
  ): Promise<CourseThumbnailUploadResult> {
    const {
      cloudinaryCloudName: cloud,
      cloudinaryApiKey: key,
      cloudinaryApiSecret: secret,
    } = this.env;
    if (!this.env.cloudinaryThumbnailsEnabled || !cloud || !key || !secret)
      throw new WorkflowException(
        "THUMBNAIL_UNAVAILABLE",
        "Thumbnail uploads are unavailable.",
        503,
      );
    return new Promise((resolve, reject) => {
      let settled = false;
      let stream:
        ReturnType<typeof cloudinary.uploader.upload_stream> | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const fail = () => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(
            new WorkflowException(
              "THUMBNAIL_UNAVAILABLE",
              "Image service is unavailable. Please retry.",
              503,
            ),
          );
        }
      };
      timer = setTimeout(() => {
        fail();
        stream?.destroy();
      }, 25_000);
      const complete = (
        error?: UploadApiErrorResponse,
        result?: UploadApiResponse,
      ) => {
        clearTimeout(timer);
        if (settled) return;
        if (error || !result) {
          fail();
          return;
        }
        try {
          const data = validateCloudinaryResult(result, cloud, publicId);
          settled = true;
          resolve(data);
        } catch {
          fail();
        }
      };
      try {
        stream = cloudinary.uploader.upload_stream(
          {
            cloud_name: cloud,
            api_key: key,
            api_secret: secret,
            resource_type: "image",
            type: "upload",
            public_id: publicId,
            overwrite: false,
            timeout: 25_000,
          },
          complete,
        );
        stream.on("error", () => {
          clearTimeout(timer);
          fail();
        });
        stream.end(body);
      } catch {
        fail();
        stream?.destroy();
      }
    });
  }
}
