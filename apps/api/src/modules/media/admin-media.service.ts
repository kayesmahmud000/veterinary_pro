import { Inject, Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  AdminUploadCreate,
  adminUploadCreateSchema,
  adminCompleteSchema,
  adminPartSchema,
  adminUploadSchema,
  adminUploadQuerySchema,
  validateAdminFile,
  JwtPayload,
  UserRole,
  VideoTranscodeJobData,
  VideoTranscodeResultDto,
} from "@vetralink/shared-types";
import { S3StorageService } from "./services/s3-storage.service";
import { VIDEO_TRANSCODE_QUEUE } from "./services/video-transcode-queue.service.interface";
import { EnvService } from "../../config/env.service";
import { AdminProductsService } from "../products/admin-products.service";
import {
  TRANSACTION_MANAGER,
  ITransactionManager,
} from "../prisma/interfaces/transaction.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../audit/repositories/audit-log.repository.interface";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  WorkflowException,
} from "../../common/exceptions/domain.exception";
import { validateWorkflow } from "../../common/utils/validate-workflow";
import { AdminMediaRepository, ManagedUpload } from "./admin-media.repository";
const partSize = 10 * 1024 * 1024;
@Injectable()
export class AdminMediaService {
  constructor(
    private readonly repo: AdminMediaRepository,
    private readonly storage: S3StorageService,
    @InjectQueue(VIDEO_TRANSCODE_QUEUE)
    private readonly queue: Queue<
      VideoTranscodeJobData,
      VideoTranscodeResultDto
    >,
    private readonly env: EnvService,
    private readonly catalog: AdminProductsService,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
  ) {}
  private jobId(id: string) {
    return `admin-transcode-${id}`;
  }
  private async owned(claims: JwtPayload, id: string) {
    const actor = await this.catalog.authorize(claims),
      row = await this.repo.get(id);
    if (!row) throw new EntityNotFoundException("Upload");
    if (row.ownerId !== claims.sub && actor.role !== UserRole.SUPER_ADMIN)
      throw new ForbiddenOperationException(
        "Only the uploader or Super Admin may change this upload.",
      );
    return row;
  }
  private async transition(
    claims: JwtPayload,
    id: string,
    data: { state: string; uploadId?: string },
    states: string[],
    action: string,
  ) {
    return this.transactions.run(async (tx) => {
      await this.catalog.authorize(claims, tx);
      const row = await this.repo.set(id, data, states, tx);
      await this.audit.record(
        {
          userId: claims.sub,
          action,
          entityType: "AdminMediaUpload",
          entityId: id,
          traceId: randomUUID(),
          newValues: { state: data.state },
        },
        tx,
      );
      return row;
    });
  }
  private active(row: ManagedUpload) {
    if (row.product.deletedAt) throw new EntityNotFoundException("Product");
  }
  private failure(code: string, message: string, status = 409): never {
    throw new WorkflowException(code, message, status);
  }
  private async processing(row: ManagedUpload) {
    if (row.product.type !== "VIDEO_COURSE" || row.state !== "UPLOADED")
      return { processingState: "idle" as const, progress: 0 };
    try {
      const job = await this.queue.getJob(this.jobId(row.id));
      if (!job) return { processingState: "idle" as const, progress: 0 };
      const state = await job.getState();
      const allowed = [
        "waiting",
        "active",
        "delayed",
        "completed",
        "failed",
      ] as const;
      return {
        processingState: allowed.includes(state as (typeof allowed)[number])
          ? (state as (typeof allowed)[number])
          : ("unavailable" as const),
        progress:
          typeof job.progress === "number"
            ? Math.min(100, Math.max(0, job.progress))
            : 0,
      };
    } catch {
      return { processingState: "unavailable" as const, progress: 0 };
    }
  }
  private async project(row: ManagedUpload) {
    return adminUploadSchema.parse({
      ...row,
      fileSizeBytes: Number(row.fileSizeBytes),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ...(await this.processing(row)),
    });
  }
  async list(claims: JwtPayload, raw: z.infer<typeof adminUploadQuerySchema>) {
    await this.catalog.authorize(claims);
    const q = validateWorkflow(adminUploadQuerySchema, raw),
      page = await this.repo.list(q);
    return {
      items: await Promise.all(page.items.map((row) => this.project(row))),
      nextCursor: page.nextCursor,
    };
  }
  async detail(claims: JwtPayload, id: string) {
    await this.catalog.authorize(claims);
    const row = await this.repo.get(id);
    if (!row) throw new EntityNotFoundException("Upload");
    return this.project(row);
  }
  async initiate(claims: JwtPayload, raw: AdminUploadCreate) {
    const input = validateWorkflow(adminUploadCreateSchema, raw),
      product = await this.catalog.detail(claims, input.productId);
    if (
      product.isPublished ||
      !validateAdminFile(
        product.type,
        input.filename,
        input.contentType,
        input.fileSizeBytes,
      )
    )
      this.failure(
        "INVALID_UPLOAD",
        "Unpublish the product and select a matching supported file.",
        422,
      );
    const reserved = await this.transactions.run(async (tx) => {
      await this.catalog.authorize(claims, tx);
      const currentProduct = await this.catalog.locked(
        input.productId,
        product.version,
        tx,
      );
      await this.catalog.manage(claims, currentProduct, tx);
      const existing = await this.repo.get(input.requestId, tx);
      if (existing) {
        if (
          existing.ownerId !== claims.sub ||
          existing.productId !== input.productId ||
          existing.filename !== input.filename ||
          existing.contentType !== input.contentType ||
          Number(existing.fileSizeBytes) !== input.fileSizeBytes
        )
          this.failure(
            "UPLOAD_REQUEST_CONFLICT",
            "Upload request does not match its reservation.",
          );
        return { row: existing, created: false };
      }
      const ext = input.filename.match(/\.[a-z0-9]+$/i)![0].toLowerCase();
      const row = await this.repo.create(
        {
          id: input.requestId,
          productId: input.productId,
          ownerId: claims.sub,
          filename: input.filename,
          contentType: input.contentType,
          fileSizeBytes: BigInt(input.fileSizeBytes),
          partSizeBytes: partSize,
          key: `admin-assets/${input.productId}/${input.requestId}${ext}`,
        },
        tx,
      );
      await this.audit.record(
        {
          userId: claims.sub,
          action: "MEDIA_UPLOAD_RESERVED",
          entityType: "AdminMediaUpload",
          entityId: row.id,
          traceId: randomUUID(),
          newValues: { productId: input.productId },
        },
        tx,
      );
      return { row, created: true };
    });
    if (!reserved.created) {
      if (reserved.row.state === "INITIALIZING")
        this.failure(
          "UPLOAD_BUSY",
          "Upload initialization is in progress; inspect or abort the session.",
        );
      return this.project(reserved.row);
    }
    let remoteUploadId: string | undefined;
    try {
      const uploadId = await this.storage.createMultipartUpload(
        this.env.s3BucketMedia,
        reserved.row.key,
        input.contentType,
      );
      remoteUploadId = uploadId;
      const row = await this.transition(
        claims,
        reserved.row.id,
        { uploadId, state: "UPLOADING" },
        ["INITIALIZING"],
        "MEDIA_UPLOAD_STARTED",
      );
      return this.project(row!);
    } catch {
      if (remoteUploadId)
        await this.storage
          .abortMultipartUpload(
            this.env.s3BucketMedia,
            reserved.row.key,
            remoteUploadId,
          )
          .catch(() => undefined);
      await this.transition(
        claims,
        reserved.row.id,
        { state: "FAILED" },
        ["INITIALIZING"],
        "MEDIA_UPLOAD_FAILED",
      ).catch(() => undefined);
      this.failure(
        "MEDIA_UNAVAILABLE",
        "Storage initialization failed. Inspect or abort the session before starting again.",
        503,
      );
    }
  }
  async part(
    claims: JwtPayload,
    id: string,
    raw: z.infer<typeof adminPartSchema>,
  ) {
    const input = validateWorkflow(adminPartSchema, raw),
      row = await this.owned(claims, id);
    this.active(row);
    if (
      row.state !== "UPLOADING" ||
      !row.uploadId ||
      input.partNumber >
        Math.ceil(Number(row.fileSizeBytes) / row.partSizeBytes)
    )
      this.failure(
        "INVALID_UPLOAD",
        "Upload part is outside the active session.",
        422,
      );
    return {
      partNumber: input.partNumber,
      url: await this.storage.getPresignedPartUploadUrl(
        this.env.s3BucketMedia,
        row.key,
        row.uploadId,
        input.partNumber,
        900,
      ),
    };
  }
  async complete(
    claims: JwtPayload,
    id: string,
    raw: z.infer<typeof adminCompleteSchema>,
  ) {
    const input = validateWorkflow(adminCompleteSchema, raw),
      row = await this.owned(claims, id);
    this.active(row);
    if (row.state === "UPLOADED") return this.project(row);
    const count = Math.ceil(Number(row.fileSizeBytes) / row.partSizeBytes),
      parts = [...input.parts].sort((a, b) => a.partNumber - b.partNumber);
    if (
      row.state !== "UPLOADING" ||
      !row.uploadId ||
      parts.length !== count ||
      parts.some((p, i) => p.partNumber !== i + 1)
    )
      this.failure(
        "INVALID_UPLOAD",
        "Provide every unique consecutive upload part.",
        422,
      );
    let object = await this.storage.statObject(this.env.s3BucketMedia, row.key);
    if (!object) {
      await this.storage.completeMultipartUpload(
        this.env.s3BucketMedia,
        row.key,
        row.uploadId,
        parts,
      );
      object = await this.storage.statObject(this.env.s3BucketMedia, row.key);
    }
    if (
      !object ||
      object.size !== Number(row.fileSizeBytes) ||
      object.contentType?.split(";")[0].toLowerCase() !== row.contentType
    )
      this.failure(
        "UPLOAD_VERIFICATION_FAILED",
        "Stored object size or content type does not match.",
      );
    const updated = await this.transition(
      claims,
      id,
      { state: "UPLOADED" },
      ["UPLOADING", "UPLOADED"],
      "MEDIA_UPLOAD_COMPLETED",
    );
    return this.project(updated!);
  }
  async abort(claims: JwtPayload, id: string) {
    const row = await this.owned(claims, id);
    if (row.state === "ABORTED") return this.project(row);
    if (row.state === "UPLOADED")
      this.failure("INVALID_UPLOAD", "Completed objects cannot be aborted.");
    if (row.uploadId) {
      try {
        await this.storage.abortMultipartUpload(
          this.env.s3BucketMedia,
          row.key,
          row.uploadId,
        );
      } catch (error) {
        if ((error as { name?: string }).name !== "NoSuchUpload") throw error;
      }
    }
    const updated = await this.transition(
      claims,
      id,
      { state: "ABORTED" },
      ["INITIALIZING", "UPLOADING", "FAILED"],
      "MEDIA_UPLOAD_ABORTED",
    );
    return this.project(updated!);
  }
  async process(claims: JwtPayload, id: string) {
    const row = await this.owned(claims, id);
    this.active(row);
    if (row.state !== "UPLOADED" || row.product.type !== "VIDEO_COURSE")
      this.failure(
        "ASSET_NOT_READY",
        "Complete a video upload before processing.",
      );
    const jobId = this.jobId(id),
      job = await this.queue.getJob(jobId);
    await this.transactions.run(async (tx) => {
      await this.catalog.authorize(claims, tx);
      await this.audit.record(
        {
          userId: claims.sub,
          action: "MEDIA_PROCESSING_REQUESTED",
          entityType: "AdminMediaUpload",
          entityId: id,
          traceId: randomUUID(),
        },
        tx,
      );
    });
    if (job) {
      if ((await job.getState()) === "failed") await job.retry("failed");
    } else
      await this.queue.add(
        "transcode",
        {
          productId: row.productId,
          rawS3Key: row.key,
          bucket: this.env.s3BucketMedia,
          requestedBy: claims.sub,
          outputPrefix: `hls/${row.productId}/${row.id}`,
        },
        {
          jobId,
          attempts: 3,
          backoff: { type: "exponential", delay: 10000 },
          removeOnComplete: { age: 604800 },
          removeOnFail: { age: 604800 },
        },
      );
    return this.project(row);
  }
  async attach(
    claims: JwtPayload,
    productId: string,
    input: { uploadId: string; expectedVersion: number },
  ) {
    const row = await this.owned(claims, input.uploadId);
    this.active(row);
    if (
      row.productId !== productId ||
      row.state !== "UPLOADED" ||
      !validateAdminFile(
        row.product.type,
        row.filename,
        row.contentType,
        Number(row.fileSizeBytes),
      )
    )
      this.failure(
        "ASSET_NOT_READY",
        "A completed upload for this product is required.",
      );
    let key = row.key;
    if (row.product.type === "VIDEO_COURSE") {
      const job = await this.queue.getJob(this.jobId(row.id));
      key = `hls/${row.productId}/${row.id}/master.m3u8`;
      if (
        !job ||
        (await job.getState()) !== "completed" ||
        job.returnvalue?.productId !== productId ||
        job.returnvalue?.masterPlaylistS3Key !== key
      )
        this.failure(
          "ASSET_NOT_READY",
          "Video processing must finish before attachment.",
        );
    }
    const stored = await this.storage.statObject(this.env.s3BucketMedia, key);
    if (!stored || stored.size <= 0)
      this.failure(
        "UPLOAD_VERIFICATION_FAILED",
        "The completed object is unavailable.",
      );
    return this.catalog.attach(claims, productId, input.expectedVersion, {
      id: row.id,
      key,
      productId: row.productId,
      type: row.product.type,
    });
  }
}
