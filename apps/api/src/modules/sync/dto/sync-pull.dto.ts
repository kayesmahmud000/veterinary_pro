import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { SyncPullRequestDto } from "@vetralink/shared-types";

export class SyncPullDto implements SyncPullRequestDto {
  @ApiProperty({
    description: "Target farm tenant UUID",
    example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  })
  @IsUUID()
  public farmId!: string;

  @ApiPropertyOptional({
    description:
      "Client's last synchronization watermark in Unix epoch milliseconds or ISO-8601 string. Null for initial full sync.",
    example: 1726000000000,
  })
  @IsOptional()
  public lastPulledAt?: number | string | null;
}
