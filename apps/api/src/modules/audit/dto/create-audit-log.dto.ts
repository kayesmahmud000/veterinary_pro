import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsObject } from "class-validator";

export class CreateAuditLogDto {
  @ApiPropertyOptional({ description: "User ID performing the action" })
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @ApiProperty({ description: "Audit action type", example: "CREATE" })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({ description: "Target entity type", example: "ANIMAL" })
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @ApiProperty({ description: "Target entity UUID" })
  @IsUUID()
  @IsNotEmpty()
  entityId: string;

  @ApiPropertyOptional({ description: "Previous state snapshot" })
  @IsOptional()
  @IsObject()
  oldValues?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: "New state snapshot" })
  @IsOptional()
  @IsObject()
  newValues?: Record<string, unknown> | null;

  @ApiProperty({ description: "Correlation trace UUID" })
  @IsUUID()
  @IsNotEmpty()
  traceId: string;

  @ApiPropertyOptional({ description: "Client IP address" })
  @IsOptional()
  @IsString()
  ipAddress?: string | null;
}
