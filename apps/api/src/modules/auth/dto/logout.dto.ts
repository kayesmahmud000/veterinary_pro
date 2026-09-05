import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class LogoutDto {
  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "Active refresh token to revoke",
  })
  @IsString()
  @IsNotEmpty({ message: "Refresh token is required" })
  public readonly refreshToken!: string;
}
