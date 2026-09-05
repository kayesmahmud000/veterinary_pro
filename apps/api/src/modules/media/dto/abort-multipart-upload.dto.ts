import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { AbortMultipartUploadRequestDto } from "@vetralink/shared-types";

export class AbortMultipartUploadDto implements AbortMultipartUploadRequestDto {
  @ApiProperty({
    example: "V0RBMjc3MzgtQ0ExNi00MTQ2LThFN0UtNDJGMzE2QTg5MUIw",
    description: "S3 multipart upload ID to cancel",
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
}
