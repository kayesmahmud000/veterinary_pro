import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { LoginRequestDto } from "@vetralink/shared-types";

export class LoginDto implements LoginRequestDto {
  @ApiProperty({
    example: "farmer@vetralink.com",
    description: "User registered email address",
  })
  @IsEmail({}, { message: "Must be a valid email address" })
  public readonly email!: string;

  @ApiProperty({
    example: "SecureP@ss123!",
    description: "User account password",
  })
  @IsString()
  @MinLength(1, { message: "Password cannot be empty" })
  public readonly password!: string;

  @ApiPropertyOptional({
    example: "+12345678901",
    description: "Alternative login identifier via phone number",
  })
  @IsOptional()
  @IsString()
  public readonly phone?: string;

  @ApiPropertyOptional({
    example: false,
    description: "Extended session retention flag",
  })
  @IsOptional()
  @IsBoolean()
  public readonly rememberMe?: boolean;
}
