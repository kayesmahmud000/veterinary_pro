import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { DrmPlaybackTokenRequestDto } from "@vetralink/shared-types";

export class DrmPlaybackTokenDto implements DrmPlaybackTokenRequestDto {
  @ApiProperty({
    description: "UUID of the video course product to obtain playback decryption token for",
    example: "11111111-1111-4111-8111-111111111111",
  })
  @IsUUID("4", { message: "productId must be a valid RFC 4122 UUID v4" })
  productId!: string;
}
