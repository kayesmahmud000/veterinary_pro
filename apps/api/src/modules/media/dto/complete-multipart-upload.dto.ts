import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import {
  CompleteMultipartUploadRequestDto,
  MultipartPartETag,
} from "@vetralink/shared-types";

export class MultipartPartETagDto implements MultipartPartETag {
  @ApiProperty({
    example: 1,
    description: "1-based sequence index of the part",
    minimum: 1,
  })
  @IsInt({ message: "partNumber must be an integer" })
  @Min(1, { message: "partNumber must be at least 1" })
  public readonly partNumber!: number;

  @ApiProperty({
    example: '"d41d8cd98f00b204e9800998ecf8427e"',
    description: "ETag checksum hash returned by S3 in the part upload response",
  })
  @IsString()
  @IsNotEmpty({ message: "etag is required" })
  public readonly etag!: string;
}

export class CompleteMultipartUploadDto
  implements CompleteMultipartUploadRequestDto
{
  @ApiProperty({
    example: "V0RBMjc3MzgtQ0ExNi00MTQ2LThFN0UtNDJGMzE2QTg5MUIw",
    description: "S3 multipart upload ID",
  })
  @IsString()
  @IsNotEmpty({ message: "uploadId is required" })
  public readonly uploadId!: string;

  @ApiProperty({
    example:
      "raw-videos/11111111-1111-1111-1111-111111111111/1725540000-uuid.mp4",
    description: "Exact S3 object key",
  })
  @IsString()
  @IsNotEmpty({ message: "key is required" })
  public readonly key!: string;

  @ApiProperty({
    type: [MultipartPartETagDto],
    description: "Sorted list of uploaded parts with their ETags",
  })
  @IsArray({ message: "parts must be an array" })
  @ArrayMinSize(1, { message: "At least one part is required to complete upload" })
  @ValidateNested({ each: true })
  @Type(() => MultipartPartETagDto)
  public readonly parts!: MultipartPartETagDto[];
}
