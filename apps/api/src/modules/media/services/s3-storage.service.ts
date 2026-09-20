import { Injectable, Logger } from "@nestjs/common";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { EnvService } from "../../../config/env.service";
import {
  IS3StorageService,
  MultipartPartInput,
} from "./s3-storage.service.interface";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

@Injectable()
export class S3StorageService implements IS3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;

  constructor(private readonly envService: EnvService) {
    const clientConfig: S3ClientConfig = {
      region: this.envService.awsRegion,
    };

    if (this.envService.s3Endpoint) {
      clientConfig.endpoint = this.envService.s3Endpoint;
    }

    if (this.envService.s3ForcePathStyle) {
      clientConfig.forcePathStyle = true;
    }

    if (this.envService.awsAccessKeyId && this.envService.awsSecretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: this.envService.awsAccessKeyId,
        secretAccessKey: this.envService.awsSecretAccessKey,
      };
    }

    this.s3Client = new S3Client(clientConfig);
  }

  public async createMultipartUpload(
    bucket: string,
    key: string,
    contentType: string
  ): Promise<string> {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      });

      const response = await this.s3Client.send(command);

      if (!response.UploadId) {
        throw new Error("S3 failed to return an UploadId.");
      }

      this.logger.log(`Initiated multipart upload on '${bucket}/${key}' [${response.UploadId}]`);
      return response.UploadId;
    } catch (error) {
      this.logger.error(
        `Failed to create multipart upload for '${bucket}/${key}': ${(error as Error).message}`
      );
      throw error;
    }
  }

  public async getPresignedPartUploadUrl(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds = 3600
  ): Promise<string> {
    if (partNumber < 1 || partNumber > 10000) {
      throw new ValidationDomainException(
        "S3 part number must be between 1 and 10000."
      );
    }

    try {
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      return await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      this.logger.error(
        `Failed to presign part URL for '${key}' part ${partNumber}: ${(error as Error).message}`
      );
      throw error;
    }
  }

  public async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: MultipartPartInput[]
  ): Promise<{ location: string; etag?: string }> {
    try {
      // S3 requires parts to be sorted in ascending order by PartNumber
      const sortedParts = [...parts]
        .sort((a, b) => a.partNumber - b.partNumber)
        .map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag,
        }));

      const command = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sortedParts,
        },
      });

      const response = await this.s3Client.send(command);

      this.logger.log(
        `Completed multipart upload for '${bucket}/${key}' [${uploadId}]`
      );

      return {
        location: response.Location || `https://${bucket}.s3.amazonaws.com/${key}`,
        etag: response.ETag,
      };
    } catch (error) {
      this.logger.error(
        `Failed to complete multipart upload for '${bucket}/${key}' [${uploadId}]: ${(error as Error).message}`
      );
      throw error;
    }
  }

  public async abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      });

      await this.s3Client.send(command);
      this.logger.log(`Aborted multipart upload for '${bucket}/${key}' [${uploadId}]`);
    } catch (error) {
      this.logger.error(
        `Failed to abort multipart upload for '${bucket}/${key}' [${uploadId}]: ${(error as Error).message}`
      );
      throw error;
    }
  }

  public async getPresignedPutUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds = 900
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      });

      return await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      this.logger.error(
        `Failed to presign PUT URL for '${bucket}/${key}': ${(error as Error).message}`
      );
      throw error;
    }
  }

  public async getPresignedGetUrl(
    bucket: string,
    key: string,
    expiresInSeconds = 900
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      this.logger.error(
        `Failed to presign GET URL for '${bucket}/${key}': ${(error as Error).message}`
      );
      throw error;
    }
  }

  public async downloadFile(
    bucket: string,
    key: string,
    localDestinationPath: string
  ): Promise<void> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      if (!response.Body) {
        throw new Error(
          `S3 GetObject returned empty body for '${bucket}/${key}'`
        );
      }

      await mkdir(dirname(localDestinationPath), { recursive: true });
      const writeStream = createWriteStream(localDestinationPath);
      await pipeline(response.Body as Readable, writeStream);

      this.logger.log(
        `Successfully downloaded 's3://${bucket}/${key}' to '${localDestinationPath}'`
      );
    } catch (error) {
      this.logger.error(
        `Failed to download 's3://${bucket}/${key}' to '${localDestinationPath}': ${(error as Error).message}`
      );
      throw error;
    }
  }

  public async uploadFileFromDisk(
    bucket: string,
    key: string,
    localFilePath: string,
    contentType: string
  ): Promise<void> {
    try {
      const fileBuffer = await readFile(localFilePath);
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);
      this.logger.log(
        `Successfully uploaded '${localFilePath}' to 's3://${bucket}/${key}' [${contentType}]`
      );
    } catch (error) {
      this.logger.error(
        `Failed to upload '${localFilePath}' to 's3://${bucket}/${key}': ${(error as Error).message}`
      );
      throw error;
    }
  }

  public async uploadBuffer(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);
      this.logger.log(
        `Successfully uploaded buffer to 's3://${bucket}/${key}' [${contentType}]`
      );
    } catch (error) {
      this.logger.error(
        `Failed to upload buffer to 's3://${bucket}/${key}': ${(error as Error).message}`
      );
      throw error;
    }
  }

  public async deleteObject(bucket: string, key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`Successfully deleted object 's3://${bucket}/${key}'`);
    } catch (error) {
      this.logger.error(
        `Failed to delete S3 object 's3://${bucket}/${key}': ${(error as Error).message}`
      );
      throw error;
    }
  }
}

