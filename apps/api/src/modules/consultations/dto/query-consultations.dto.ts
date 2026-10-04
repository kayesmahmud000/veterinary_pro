import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import {
  ConsultationStatus,
  ConsultationType,
  QueryFarmerConsultationsDto,
} from "@vetralink/shared-types";

export class QueryConsultationsDto implements QueryFarmerConsultationsDto {
  @ApiPropertyOptional({
    description: "Page number for pagination",
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Items per page",
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: "Filter consultations by status",
    enum: ConsultationStatus,
  })
  @IsOptional()
  @IsEnum(ConsultationStatus)
  status?: ConsultationStatus;

  @ApiPropertyOptional({
    description: "Filter consultations by specific animal UUID",
  })
  @IsOptional()
  @IsUUID()
  animalId?: string;

  @ApiPropertyOptional({
    description: "Filter consultations by type (ASYNC_TICKET or LIVE_VIDEO)",
    enum: ConsultationType,
  })
  @IsOptional()
  @IsEnum(ConsultationType)
  type?: ConsultationType;
}
