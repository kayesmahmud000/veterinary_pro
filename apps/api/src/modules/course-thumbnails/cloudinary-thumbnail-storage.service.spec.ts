import { Writable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryThumbnailStorage } from "./cloudinary-thumbnail-storage.service";
const env = {
  cloudinaryThumbnailsEnabled: true,
  cloudinaryCloudName: "test-cloud",
  cloudinaryApiKey: "123",
  cloudinaryApiSecret: "synthetic-secret",
};
const result = {
  public_id: "course-thumbnails/test",
  version: 1,
  format: "webp",
  secure_url:
    "https://res.cloudinary.com/test-cloud/image/upload/v1/course-thumbnails/test.webp",
};
describe("isolated Cloudinary upload adapter", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it("passes backend credentials and immutable generated ID to the SDK and returns only acknowledged URL", async () => {
    const stream = new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    });
    const spy = jest
      .spyOn(cloudinary.uploader, "upload_stream")
      .mockImplementation(((_options: any, callback: any) => {
        queueMicrotask(() => callback(undefined, result));
        return stream;
      }) as any);
    const adapter = new CloudinaryThumbnailStorage(env as any);
    await expect(
      adapter.put(result.public_id, Buffer.from("webp"), "image/webp"),
    ).resolves.toEqual({ url: result.secure_url });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        cloud_name: "test-cloud",
        api_key: "123",
        api_secret: "synthetic-secret",
        public_id: result.public_id,
        resource_type: "image",
        type: "upload",
        overwrite: false,
      }),
      expect.any(Function),
    );
  });
  it("redacts synchronous SDK failures", async () => {
    jest.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(() => {
      throw new Error("synthetic-secret-provider-detail");
    });
    await expect(
      new CloudinaryThumbnailStorage(env as any).put(
        result.public_id,
        Buffer.alloc(1),
        "image/webp",
      ),
    ).rejects.toMatchObject({
      errorCode: "THUMBNAIL_UNAVAILABLE",
      statusCode: 503,
    });
  });
  it("times out once, destroys stream and ignores late acknowledgements", async () => {
    jest.useFakeTimers();
    let callback: any;
    const stream = new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      }),
      destroy = jest.spyOn(stream, "destroy");
    jest.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
      _options: any,
      cb: any,
    ) => {
      callback = cb;
      return stream;
    }) as any);
    const pending = new CloudinaryThumbnailStorage(env as any).put(
      result.public_id,
      Buffer.alloc(1),
      "image/webp",
    );
    const rejected = expect(pending).rejects.toMatchObject({
      errorCode: "THUMBNAIL_UNAVAILABLE",
    });
    jest.advanceTimersByTime(25_000);
    await rejected;
    expect(destroy).toHaveBeenCalled();
    callback(undefined, result);
  });
});
