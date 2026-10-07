import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsUUID,
  MaxLength,
} from "class-validator";
import { FarmRole } from "@vetralink/shared-types";

export class AddFarmMemberDto {
  @ApiPropertyOptional({
    description: "UUID of the user to add as farm member",
    example: "c794025f-a3c3-4d76-8f35-e11b3bc29c12",
  })
  @IsUUID("4", { message: "userId must be a valid UUID v4" })
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: "Existing account email; provide email or userId, never both",
  })
  @IsEmail()
  @MaxLength(254)
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: "Role assigned to the farm member",
    enum: FarmRole,
    default: FarmRole.HERDSMAN,
  })
  @IsEnum(FarmRole, { message: "Invalid farm role" })
  @IsOptional()
  role?: FarmRole;
}
