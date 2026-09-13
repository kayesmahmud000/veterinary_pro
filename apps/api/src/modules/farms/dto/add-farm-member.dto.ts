import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from "class-validator";
import { FarmRole } from "@vetralink/shared-types";

export class AddFarmMemberDto {
  @ApiProperty({
    description: "UUID of the user to add as farm member",
    example: "c794025f-a3c3-4d76-8f35-e11b3bc29c12",
  })
  @IsUUID("4", { message: "userId must be a valid UUID v4" })
  @IsNotEmpty({ message: "userId is required" })
  userId!: string;

  @ApiPropertyOptional({
    description: "Role assigned to the farm member",
    enum: FarmRole,
    default: FarmRole.HERDSMAN,
  })
  @IsEnum(FarmRole, { message: "Invalid farm role" })
  @IsOptional()
  role?: FarmRole;
}
