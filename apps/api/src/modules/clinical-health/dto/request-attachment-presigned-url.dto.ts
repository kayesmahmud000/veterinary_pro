import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  ALLOWED_HEALTH_ATTACHMENT_MIME_TYPES,
  MAX_HEALTH_ATTACHMENT_SIZE_BYTES,
} from "../entities/health-record-attachment.entity";

export class RequestAttachmentPresignedUrlDto {
  @ApiProperty({
    description: "Original client file name with extension",
    example: "lesion-left-flank.jpg",
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  public fileName!: string;

  @ApiProperty({
    description: "MIME content type of the image",
    example: "image/jpeg",
    enum: ALLOWED_HEALTH_ATTACHMENT_MIME_TYPES,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_HEALTH_ATTACHMENT_MIME_TYPES as unknown as string[], {
    message: `mimeType must be one of: ${ALLOWED_HEALTH_ATTACHMENT_MIME_TYPES.join(", ")}`,
  })
  public mimeType!: string;

  @ApiProperty({
    description: "File size in bytes (maximum 15MB)",
    example: 2048576,
    maximum: MAX_HEALTH_ATTACHMENT_SIZE_BYTES,
    minimum: 1,
  })
  @IsInt()
  @Min(1, { message: "fileSizeBytes must be at least 1 byte" })
  @Max(MAX_HEALTH_ATTACHMENT_SIZE_BYTES, {
    message: `fileSizeBytes cannot exceed ${MAX_HEALTH_ATTACHMENT_SIZE_BYTES} bytes (15 MB)`,
  })
  public fileSizeBytes!: number;

  @ApiPropertyOptional({
    description: "Optional notes or clinical caption for the lesion image",
    example: "Purulent drainage from left flank lesion",
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public caption?: string;
}
