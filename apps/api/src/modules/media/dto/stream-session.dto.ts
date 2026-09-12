import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { StreamPlaybackSessionRequestDto } from "@vetralink/shared-types";

export class StreamPlaybackSessionDto
  implements StreamPlaybackSessionRequestDto
{
  @ApiProperty({
    description: "UUID of the video course product to stream",
    example: "11111111-1111-4111-8111-111111111111",
  })
  @IsUUID("4", { message: "productId must be a valid UUID v4" })
  productId!: string;
}
