import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ConsultationNotificationChannel,
  QueryVetNotificationsDto,
} from "@vetralink/shared-types";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class QueryVetNotificationsRequestDto
  implements QueryVetNotificationsDto
{
  @ApiPropertyOptional({
    description: "Page number (1-indexed)",
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: "Page size",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: "Filter by notification channel",
    enum: ConsultationNotificationChannel,
  })
  @IsOptional()
  @IsEnum(ConsultationNotificationChannel)
  channel?: ConsultationNotificationChannel;

  @ApiPropertyOptional({
    description: "If true, only return unread notifications",
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}
