import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AssignConsultationDto as IAssignConsultationDto } from "@vetralink/shared-types";
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class AssignConsultationDto implements IAssignConsultationDto {
  @ApiProperty({
    description: "UUID of the veterinarian being assigned to this consultation",
    example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  })
  @IsNotEmpty({ message: "Veterinarian ID is required" })
  @IsUUID("4", { message: "Veterinarian ID must be a valid UUID" })
  vetId!: string;

  @ApiPropertyOptional({
    description: "Optional appointment start timestamp for live video session or scheduled async review (ISO 8601)",
    example: "2026-09-21T14:30:00.000Z",
  })
  @IsOptional()
  @IsISO8601({}, { message: "scheduledAt must be a valid ISO 8601 timestamp" })
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: "Optional triage notes or instructions for the assigned veterinarian",
    maxLength: 500,
    example: "Farmer reported high fever for 48h. Animal is isolated in pen 4.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Notes must not exceed 500 characters" })
  notes?: string;
}
