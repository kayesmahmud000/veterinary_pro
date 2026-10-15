import { AdminMediaService } from "./admin-media.service";
import { MediaUploadService } from "./services/media-upload.service";
import { JwtPayload, UserRole } from "@vetralink/shared-types";
const id = "550e8400-e29b-41d4-a716-446655440001",
  productId = "550e8400-e29b-41d4-a716-446655440002";
const claims = {
  sub: id,
  role: UserRole.ADMIN,
  authorizationVersion: 0,
} as JwtPayload;
const file = {
  id,
  productId,
  ownerId: id,
  filename: "guide.pdf",
  contentType: "application/pdf",
  fileSizeBytes: BigInt(20),
  partSizeBytes: 10485760,
  key: `admin-assets/${productId}/${id}.pdf`,
  uploadId: "remote",
  state: "UPLOADING",
  createdAt: new Date(),
  updatedAt: new Date(),
  product: {
    id: productId,
    title: "Guide",
    type: "EBOOK",
    version: 0,
    isPublished: false,
    deletedAt: null,
    metadata: {},
  },
};
describe("Managed media boundaries and recovery", () => {
  let service: AdminMediaService,
    repo: any,
    storage: any,
    queue: any,
    catalog: any;
  beforeEach(() => {
    repo = {
      get: jest.fn(async () => ({ ...file })),
      set: jest.fn(async (_id, data) => ({ ...file, ...data })),
      list: jest.fn(async () => ({ items: [], nextCursor: null })),
    };
    storage = {
      statObject: jest.fn(async () => null),
      completeMultipartUpload: jest.fn(async () => ({ location: "private" })),
      getPresignedPartUploadUrl: jest.fn(
        async () => "https://storage.example.test/part",
      ),
    };
    queue = {
      getJob: jest.fn(async () => null),
      add: jest.fn(async () => ({ id: "job" })),
    };
    catalog = {
      authorize: jest.fn(async () => ({ role: UserRole.ADMIN })),
      attach: jest.fn(),
    };
    service = new AdminMediaService(
      repo,
      storage,
      queue,
      { s3BucketMedia: "synthetic" } as any,
      catalog,
      { run: async (fn: any) => fn({}) } as any,
      { record: jest.fn() } as any,
    );
  });
  it("denies another uploader before signing a part", async () => {
    repo.get.mockResolvedValue({ ...file, ownerId: productId });
    await expect(service.part(claims, id, { partNumber: 1 })).rejects.toThrow();
    expect(storage.getPresignedPartUploadUrl).not.toHaveBeenCalled();
  });
  it("bounds parts to the persisted file rather than trusting the client", async () => {
    await expect(service.part(claims, id, { partNumber: 2 })).rejects.toThrow();
    expect(storage.getPresignedPartUploadUrl).not.toHaveBeenCalled();
  });
  it("rejects duplicate or incomplete multipart manifests before provider completion", async () => {
    await expect(
      service.complete(claims, id, {
        parts: [
          { partNumber: 1, etag: "a" },
          { partNumber: 1, etag: "b" },
        ],
      }),
    ).rejects.toThrow();
    expect(storage.completeMultipartUpload).not.toHaveBeenCalled();
  });
  it("recovers completion after a lost provider acknowledgment by checking object metadata", async () => {
    storage.statObject.mockResolvedValue({
      size: 20,
      contentType: "application/pdf",
    });
    const result = await service.complete(claims, id, {
      parts: [{ partNumber: 1, etag: "a" }],
    });
    expect(result.state).toBe("UPLOADED");
    expect(storage.completeMultipartUpload).not.toHaveBeenCalled();
  });
  it("does not mark mismatched objects uploaded", async () => {
    storage.statObject.mockResolvedValue({
      size: 21,
      contentType: "application/pdf",
    });
    await expect(
      service.complete(claims, id, { parts: [{ partNumber: 1, etag: "a" }] }),
    ).rejects.toThrow();
    expect(repo.set).not.toHaveBeenCalled();
  });
  it("retries the same failed queue job rather than enqueueing a duplicate", async () => {
    repo.get.mockResolvedValue({
      ...file,
      state: "UPLOADED",
      product: { ...file.product, type: "VIDEO_COURSE" },
    });
    const job = {
      getState: async () => "failed",
      retry: jest.fn(async () => {}),
      progress: 0,
    };
    queue.getJob.mockResolvedValue(job);
    await service.process(claims, id);
    expect(job.retry).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
  it("legacy arbitrary-key methods cannot sign managed objects", async () => {
    const store = { getPresignedPartUploadUrl: jest.fn() };
    const old = new MediaUploadService(
      store as any,
      { s3BucketMedia: "synthetic" } as any,
    );
    await expect(
      old.getPresignedPartUrl({
        key: file.key,
        uploadId: "remote",
        partNumber: 1,
      }),
    ).rejects.toThrow();
    expect(store.getPresignedPartUploadUrl).not.toHaveBeenCalled();
  });
  it("cleans a known remote session if initialization cannot be persisted", async () => {
    repo.get.mockResolvedValue(null);
    repo.create = jest.fn(async () => ({
      ...file,
      state: "INITIALIZING",
      uploadId: null,
    }));
    repo.set.mockRejectedValue(new Error("database unavailable"));
    catalog.detail = jest.fn(async () => ({
      id: productId,
      type: "EBOOK",
      version: 0,
      isPublished: false,
    }));
    catalog.locked = jest.fn(async () => ({
      id: productId,
      type: "EBOOK",
      version: 0,
      metadata: { adminManaged: true },
    }));
    catalog.manage = jest.fn();
    storage.createMultipartUpload = jest.fn(async () => "known-remote-id");
    storage.abortMultipartUpload = jest.fn(async () => {});
    await expect(
      service.initiate(claims, {
        requestId: id,
        productId,
        filename: "guide.pdf",
        contentType: "application/pdf",
        fileSizeBytes: 20,
      }),
    ).rejects.toThrow();
    expect(storage.abortMultipartUpload).toHaveBeenCalledWith(
      "synthetic",
      file.key,
      "known-remote-id",
    );
  });
  it("treats a provider NoSuchUpload as an already-aborted session on retry", async () => {
    storage.abortMultipartUpload = jest.fn(async () => {
      throw Object.assign(new Error("missing"), { name: "NoSuchUpload" });
    });
    const result = await service.abort(claims, id);
    expect(result.state).toBe("ABORTED");
  });
});
