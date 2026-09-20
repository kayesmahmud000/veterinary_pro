import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ConsultationNotificationChannel,
  NotifyVetDto,
} from "@vetralink/shared-types";
import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class NotifyVetRequestDto implements NotifyVetDto {
  @ApiPropertyOptional({
    description: "Channels to dispatch notifications across",
    enum: ConsultationNotificationChannel,
    isArray: true,
    example: [
      ConsultationNotificationChannel.IN_APP,
      ConsultationNotificationChannel.PUSH,
    ],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ConsultationNotificationChannel, { each: true })
  channels?: ConsultationNotificationChannel[];

  @ApiPropertyOptional({
    description: "Optional custom clinical message or note to include",
    maxLength: 500,
    example: "Please prioritize: animal has high fever and severe lethargy.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customNote?: string;
}
