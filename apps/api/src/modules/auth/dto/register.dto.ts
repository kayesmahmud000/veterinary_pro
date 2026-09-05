import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { RegisterRequestDto, UserRole } from "@vetralink/shared-types";

export class RegisterDto implements RegisterRequestDto {
  @ApiProperty({
    example: "farmer@vetralink.com",
    description: "User primary email address",
  })
  @IsEmail({}, { message: "Must be a valid email address" })
  public readonly email!: string;

  @ApiProperty({
    example: "SecureP@ss123!",
    description: "User password (minimum 8 characters)",
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(128, { message: "Password must not exceed 128 characters" })
  public readonly password!: string;

  @ApiProperty({
    example: "John Doe",
    description: "Full name of the user",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: "Name is required" })
  @MinLength(2, { message: "Name must be at least 2 characters long" })
  @MaxLength(100, { message: "Name must not exceed 100 characters" })
  public readonly name!: string;

  @ApiPropertyOptional({
    enum: UserRole,
    default: UserRole.FARMER,
    description: "Requested role for the user (FARMER, VET, BUYER)",
  })
  @IsOptional()
  @IsEnum(UserRole, {
    message: "Role must be a valid UserRole (FARMER, VET, BUYER)",
  })
  public readonly role?: UserRole;

  @ApiPropertyOptional({
    example: "+12345678901",
    description: "Contact phone number in international format",
  })
  @IsOptional()
  @IsString()
  public readonly phone?: string;
}
