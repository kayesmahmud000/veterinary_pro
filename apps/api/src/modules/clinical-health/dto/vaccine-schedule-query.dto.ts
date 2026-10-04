import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class VaccineScheduleQueryDto {
  @ApiPropertyOptional({
    example: 30,
    default: 30,
    description: "Number of days ahead to look for upcoming vaccinations/dewormings",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  public readonly daysAhead?: number = 30;

  @ApiPropertyOptional({
    example: "2026-09-13",
    description: "Reference date to calculate overdue and due-soon statuses (defaults to current server date)",
  })
  @IsOptional()
  @IsDateString()
  public readonly asOfDate?: string;
}
