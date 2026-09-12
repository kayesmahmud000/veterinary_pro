import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { CheckTagAvailabilityDto } from "@vetralink/shared-types";

export class CheckTagAvailabilityQueryDto implements CheckTagAvailabilityDto {
  @ApiPropertyOptional({
    example: "COW-00124",
    description: "Visual ear tag number to check for active herd uniqueness",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  public readonly tagNumber?: string;

  @ApiPropertyOptional({
    example: "982000123456789",
    description: "Electronic RFID transponder number to check for active herd uniqueness",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  public readonly rfidNumber?: string;

  @ApiPropertyOptional({
    example: "c7f99ff9-7b3b-48aa-b5a8-ef6e534f3c7a",
    description: "Animal ID to exclude from collision check during record update",
  })
  @IsOptional()
  @IsUUID("4")
  public readonly excludeAnimalId?: string;
}
