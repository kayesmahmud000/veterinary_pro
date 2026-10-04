import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";
import { QueueTranscodeRequestDto } from "@vetralink/shared-types";

export class QueueTranscodeDto implements QueueTranscodeRequestDto {
  @ApiProperty({
    example: "11111111-1111-1111-1111-111111111111",
    description: "Product UUID of the video course",
  })
  @IsUUID(undefined, { message: "productId must be a valid UUID" })
  @IsNotEmpty({ message: "productId is required" })
  public readonly productId!: string;

  @ApiProperty({
    example:
      "raw-videos/11111111-1111-1111-1111-111111111111/1725540000-uuid.mp4",
    description: "S3 object key of the raw master video",
  })
  @IsString()
  @IsNotEmpty({ message: "rawS3Key is required" })
  public readonly rawS3Key!: string;
}
