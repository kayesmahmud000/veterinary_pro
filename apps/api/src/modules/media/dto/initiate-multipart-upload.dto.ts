import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import {
  InitiateMultipartUploadRequestDto,
  MediaCategory,
} from "@vetralink/shared-types";

export class InitiateMultipartUploadDto
  implements InitiateMultipartUploadRequestDto
{
  @ApiProperty({
    example: "bovine-surgery-master.mp4",
    description: "Original filename with extension",
  })
  @IsString()
  @IsNotEmpty({ message: "filename is required" })
  public readonly filename!: string;

  @ApiProperty({
    example: "video/mp4",
    description: "Standard MIME content type",
  })
  @IsString()
  @IsNotEmpty({ message: "contentType is required" })
  public readonly contentType!: string;

  @ApiProperty({
    example: 2147483648,
    description: "Total file size in integer bytes (e.g. 2GB = 2147483648)",
    minimum: 1,
  })
  @IsInt({ message: "fileSizeBytes must be an integer" })
  @Min(1, { message: "fileSizeBytes must be greater than 0" })
  public readonly fileSizeBytes!: number;

  @ApiProperty({
    enum: MediaCategory,
    example: MediaCategory.VIDEO_COURSE,
    description: "Asset category determines S3 folder partitioning and validation policy",
  })
  @IsEnum(MediaCategory, {
    message:
      "category must be one of: VIDEO_COURSE, EBOOK, EXCEL_TOOL, THUMBNAIL, ATTACHMENT",
  })
  public readonly category!: MediaCategory;

  @ApiPropertyOptional({
    example: "11111111-1111-1111-1111-111111111111",
    description: "Optional product or entity UUID for key partitioning",
  })
  @IsOptional()
  @IsString()
  public readonly entityId?: string;
}
