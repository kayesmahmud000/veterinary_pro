import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ConsultationType,
  CreateConsultationRequestDto,
} from "@vetralink/shared-types";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateConsultationDto implements CreateConsultationRequestDto {
  @ApiProperty({
    description: "UUID of the farm tenant where the consultation is requested",
    example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  })
  @IsUUID()
  @IsNotEmpty()
  farmId: string;

  @ApiPropertyOptional({
    description: "Optional UUID of the specific animal requiring consultation",
    example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
  })
  @IsUUID()
  @IsOptional()
  animalId?: string;

  @ApiProperty({
    description: "Clinical description of symptoms, onset, and behavior",
    example: "Cow showing signs of acute lethargy, decreased milk yield, and nasal discharge for past 2 days.",
    minLength: 10,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  chiefComplaint: string;

  @ApiPropertyOptional({
    description: "Array of presigned or public media URLs depicting lesions, posture, or symptoms",
    type: [String],
    example: ["https://s3.amazonaws.com/vetralink-media/consultations/lesion1.jpg"],
  })
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  mediaUrls?: string[];

  @ApiPropertyOptional({
    description: "Type of consultation: ASYNC_TICKET (default) or LIVE_VIDEO",
    enum: ConsultationType,
    default: ConsultationType.ASYNC_TICKET,
  })
  @IsEnum(ConsultationType)
  @IsOptional()
  type?: ConsultationType;

  @ApiPropertyOptional({
    description: "Currency code for consultation fee (default USD)",
    default: "USD",
    example: "USD",
  })
  @IsString()
  @IsOptional()
  currency?: string;
}
