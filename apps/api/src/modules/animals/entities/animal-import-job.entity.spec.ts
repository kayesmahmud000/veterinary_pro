import { ImportJobStatus } from "@vetralink/shared-types";
import { AnimalImportJobEntity } from "./animal-import-job.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("AnimalImportJobEntity", () => {
  const validProps = {
    farmId: "11111111-1111-1111-1111-111111111111",
    uploadedById: "22222222-2222-2222-2222-222222222222",
    fileName: "herd_migration.csv",
    fileSize: 1024,
    fileType: "csv",
  };

  it("should create an AnimalImportJobEntity with default pending state", () => {
    const job = AnimalImportJobEntity.create(validProps);

    expect(job.id).toBeDefined();
    expect(job.farmId).toBe(validProps.farmId);
    expect(job.uploadedById).toBe(validProps.uploadedById);
    expect(job.fileName).toBe("herd_migration.csv");
    expect(job.fileSize).toBe(1024);
    expect(job.fileType).toBe("csv");
    expect(job.status).toBe(ImportJobStatus.PENDING);
    expect(job.totalRows).toBe(0);
    expect(job.processedRows).toBe(0);
    expect(job.successfulRows).toBe(0);
    expect(job.failedRows).toBe(0);
    expect(job.errorReport).toBeNull();
    expect(job.calculateProgressPercentage()).toBe(0);
  });

  it("should throw ValidationDomainException for empty fileName", () => {
    expect(() =>
      AnimalImportJobEntity.create({
        ...validProps,
        fileName: "   ",
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException for zero or negative fileSize", () => {
    expect(() =>
      AnimalImportJobEntity.create({
        ...validProps,
        fileSize: 0,
      })
    ).toThrow(ValidationDomainException);

    expect(() =>
      AnimalImportJobEntity.create({
        ...validProps,
        fileSize: -100,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException for unsupported file types", () => {
    expect(() =>
      AnimalImportJobEntity.create({
        ...validProps,
        fileType: "pdf",
      })
    ).toThrow(ValidationDomainException);
  });

  it("should transition through job lifecycle: start -> recordProgress -> complete", () => {
    const job = AnimalImportJobEntity.create(validProps);

    job.start(100);
    expect(job.status).toBe(ImportJobStatus.PROCESSING);
    expect(job.totalRows).toBe(100);
    expect(job.startedAt).toBeDefined();

    job.recordProgress(50, 48, 2, [
      { row: 10, message: "Duplicate tag" },
      { row: 25, message: "Invalid species" },
    ]);
    expect(job.processedRows).toBe(50);
    expect(job.successfulRows).toBe(48);
    expect(job.failedRows).toBe(2);
    expect(job.errorReport).toHaveLength(2);
    expect(job.calculateProgressPercentage()).toBe(50);

    job.complete();
    expect(job.status).toBe(ImportJobStatus.PARTIALLY_COMPLETED);
    expect(job.completedAt).toBeDefined();
  });

  it("should mark COMPLETED if 0 failures occur", () => {
    const job = AnimalImportJobEntity.create(validProps);
    job.start(50);
    job.recordProgress(50, 50, 0);
    job.complete();

    expect(job.status).toBe(ImportJobStatus.COMPLETED);
    expect(job.calculateProgressPercentage()).toBe(100);
  });

  it("should mark FAILED if all rows fail", () => {
    const job = AnimalImportJobEntity.create(validProps);
    job.start(10);
    job.recordProgress(10, 0, 10, [{ row: 1, message: "Bad row" }]);
    job.complete();

    expect(job.status).toBe(ImportJobStatus.FAILED);
  });

  it("should record crash failure when fail() is invoked", () => {
    const job = AnimalImportJobEntity.create(validProps);
    job.fail("Corrupt spreadsheet file");

    expect(job.status).toBe(ImportJobStatus.FAILED);
    expect(job.errorReport).toEqual([
      { row: 0, message: "Corrupt spreadsheet file" },
    ]);
  });

  it("should serialize to response DTO properly", () => {
    const job = AnimalImportJobEntity.create(validProps);
    const dto = job.toResponse();

    expect(dto.id).toBe(job.id);
    expect(dto.status).toBe(ImportJobStatus.PENDING);
    expect(dto.progressPercentage).toBe(0);
    expect(dto.startedAt).toBeNull();
    expect(dto.completedAt).toBeNull();
  });
});
