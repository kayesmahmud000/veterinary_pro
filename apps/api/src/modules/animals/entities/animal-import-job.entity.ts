import {
  AnimalImportJobDto,
  AnimalImportRowErrorDto,
  ImportJobStatus,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface AnimalImportJobProps {
  id?: string;
  farmId: string;
  uploadedById: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status?: ImportJobStatus;
  totalRows?: number;
  processedRows?: number;
  successfulRows?: number;
  failedRows?: number;
  errorReport?: AnimalImportRowErrorDto[] | null;
  filePath?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AnimalImportJobEntity {
  private readonly _id: string;
  private readonly _farmId: string;
  private readonly _uploadedById: string;
  private readonly _fileName: string;
  private readonly _fileSize: number;
  private readonly _fileType: string;
  private _status: ImportJobStatus;
  private _totalRows: number;
  private _processedRows: number;
  private _successfulRows: number;
  private _failedRows: number;
  private _errorReport: AnimalImportRowErrorDto[] | null;
  private _filePath: string | null;
  private _startedAt: Date | null;
  private _completedAt: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: AnimalImportJobProps) {
    this._id = props.id ?? crypto.randomUUID();
    this._farmId = props.farmId;
    this._uploadedById = props.uploadedById;
    this._fileName = props.fileName.trim();
    this._fileSize = props.fileSize;
    this._fileType = props.fileType.toLowerCase().trim();
    this._status = props.status ?? ImportJobStatus.PENDING;
    this._totalRows = props.totalRows ?? 0;
    this._processedRows = props.processedRows ?? 0;
    this._successfulRows = props.successfulRows ?? 0;
    this._failedRows = props.failedRows ?? 0;
    this._errorReport = props.errorReport ?? null;
    this._filePath = props.filePath ?? null;
    this._startedAt = props.startedAt ?? null;
    this._completedAt = props.completedAt ?? null;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();

    this.validate();
  }

  public static create(
    props: Omit<
      AnimalImportJobProps,
      | "id"
      | "status"
      | "totalRows"
      | "processedRows"
      | "successfulRows"
      | "failedRows"
      | "errorReport"
      | "startedAt"
      | "completedAt"
      | "createdAt"
      | "updatedAt"
    >
  ): AnimalImportJobEntity {
    return new AnimalImportJobEntity(props);
  }

  public static reconstitute(props: AnimalImportJobProps): AnimalImportJobEntity {
    return new AnimalImportJobEntity(props);
  }

  private validate(): void {
    if (!this._fileName) {
      throw new ValidationDomainException("Import job fileName cannot be empty.");
    }
    if (this._fileSize <= 0) {
      throw new ValidationDomainException("Import job fileSize must be greater than 0.");
    }
    const allowedTypes = ["csv", "xlsx", "xls"];
    if (!allowedTypes.includes(this._fileType)) {
      throw new ValidationDomainException(
        `Unsupported file type '${this._fileType}'. Allowed types: ${allowedTypes.join(", ")}.`
      );
    }
    if (this._totalRows < 0 || this._processedRows < 0) {
      throw new ValidationDomainException("Row counts cannot be negative.");
    }
  }

  public start(totalRows: number): void {
    if (this._status !== ImportJobStatus.PENDING) {
      throw new ValidationDomainException(
        `Cannot start job with current status '${this._status}'.`
      );
    }
    this._status = ImportJobStatus.PROCESSING;
    this._totalRows = Math.max(0, totalRows);
    this._startedAt = new Date();
    this._updatedAt = new Date();
  }

  public recordProgress(
    processed: number,
    successful: number,
    failed: number,
    newErrors?: AnimalImportRowErrorDto[]
  ): void {
    this._processedRows = processed;
    this._successfulRows = successful;
    this._failedRows = failed;

    if (newErrors && newErrors.length > 0) {
      const current = this._errorReport ?? [];
      this._errorReport = [...current, ...newErrors];
    }
    this._updatedAt = new Date();
  }

  public complete(): void {
    if (this._failedRows > 0 && this._successfulRows > 0) {
      this._status = ImportJobStatus.PARTIALLY_COMPLETED;
    } else if (this._failedRows > 0 && this._successfulRows === 0) {
      this._status = ImportJobStatus.FAILED;
    } else {
      this._status = ImportJobStatus.COMPLETED;
    }
    this._completedAt = new Date();
    this._updatedAt = new Date();
  }

  public fail(errorMessage: string): void {
    this._status = ImportJobStatus.FAILED;
    this._completedAt = new Date();
    const current = this._errorReport ?? [];
    this._errorReport = [
      ...current,
      {
        row: 0,
        message: errorMessage,
      },
    ];
    this._updatedAt = new Date();
  }

  public clearFilePath(): void {
    this._filePath = null;
    this._updatedAt = new Date();
  }

  // Getters
  public get id(): string {
    return this._id;
  }
  public get farmId(): string {
    return this._farmId;
  }
  public get uploadedById(): string {
    return this._uploadedById;
  }
  public get fileName(): string {
    return this._fileName;
  }
  public get fileSize(): number {
    return this._fileSize;
  }
  public get fileType(): string {
    return this._fileType;
  }
  public get status(): ImportJobStatus {
    return this._status;
  }
  public get totalRows(): number {
    return this._totalRows;
  }
  public get processedRows(): number {
    return this._processedRows;
  }
  public get successfulRows(): number {
    return this._successfulRows;
  }
  public get failedRows(): number {
    return this._failedRows;
  }
  public get errorReport(): AnimalImportRowErrorDto[] | null {
    return this._errorReport ? [...this._errorReport] : null;
  }
  public get filePath(): string | null {
    return this._filePath;
  }
  public get startedAt(): Date | null {
    return this._startedAt;
  }
  public get completedAt(): Date | null {
    return this._completedAt;
  }
  public get createdAt(): Date {
    return this._createdAt;
  }
  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public calculateProgressPercentage(): number {
    if (this._totalRows <= 0) {
      return this._status === ImportJobStatus.COMPLETED ? 100 : 0;
    }
    return Math.min(100, Math.round((this._processedRows / this._totalRows) * 100));
  }

  public toResponse(): AnimalImportJobDto {
    return {
      id: this._id,
      farmId: this._farmId,
      uploadedById: this._uploadedById,
      fileName: this._fileName,
      fileSize: this._fileSize,
      fileType: this._fileType,
      status: this._status,
      totalRows: this._totalRows,
      processedRows: this._processedRows,
      successfulRows: this._successfulRows,
      failedRows: this._failedRows,
      errorReport: this._errorReport,
      progressPercentage: this.calculateProgressPercentage(),
      startedAt: this._startedAt?.toISOString() ?? null,
      completedAt: this._completedAt?.toISOString() ?? null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
