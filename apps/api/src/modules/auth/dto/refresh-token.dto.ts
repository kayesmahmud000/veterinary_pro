import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { RefreshTokenRequestDto } from "@vetralink/shared-types";

export class RefreshTokenDto implements RefreshTokenRequestDto {
  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "Valid cryptographically signed refresh token",
  })
  @IsString()
  @IsNotEmpty({ message: "Refresh token is required" })
  public readonly refreshToken!: string;
}
