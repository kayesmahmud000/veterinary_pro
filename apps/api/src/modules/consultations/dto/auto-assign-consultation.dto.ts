import { ApiPropertyOptional } from "@nestjs/swagger";
import { AutoAssignConsultationDto as IAutoAssignConsultationDto } from "@vetralink/shared-types";
import { IsISO8601, IsOptional } from "class-validator";

export class AutoAssignConsultationDto implements IAutoAssignConsultationDto {
  @ApiPropertyOptional({
    description: "Optional appointment start timestamp for live video session (ISO 8601)",
    example: "2026-09-21T14:30:00.000Z",
  })
  @IsOptional()
  @IsISO8601({}, { message: "scheduledAt must be a valid ISO 8601 timestamp" })
  scheduledAt?: string;
}
