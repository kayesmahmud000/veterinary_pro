import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, Max, Min } from "class-validator";
import { GetPresignedPartUrlRequestDto } from "@vetralink/shared-types";

export class GetPresignedPartUrlDto implements GetPresignedPartUrlRequestDto {
  @ApiProperty({
    example: "V0RBMjc3MzgtQ0ExNi00MTQ2LThFN0UtNDJGMzE2QTg5MUIw",
    description: "S3 multipart upload ID returned by initiate endpoint",
  })
  @IsString()
  @IsNotEmpty({ message: "uploadId is required" })
  public readonly uploadId!: string;

  @ApiProperty({
    example:
      "raw-videos/11111111-1111-1111-1111-111111111111/1725540000-uuid.mp4",
    description: "Exact S3 object key returned during upload initiation",
  })
  @IsString()
  @IsNotEmpty({ message: "key is required" })
  public readonly key!: string;

  @ApiProperty({
    example: 1,
    description: "1-based sequence index of the part (1 to 10,000)",
    minimum: 1,
    maximum: 10000,
  })
  @IsInt({ message: "partNumber must be an integer" })
  @Min(1, { message: "partNumber must be at least 1" })
  @Max(10000, { message: "partNumber cannot exceed 10000" })
  public readonly partNumber!: number;
}
