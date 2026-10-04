import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsObject, IsUUID } from "class-validator";
import {
  SyncPushRequestDto,
  SyncPushTableChangesMap,
} from "@vetralink/shared-types";

export class SyncPushDto implements SyncPushRequestDto {
  @ApiProperty({
    description: "Target farm tenant UUID",
    example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  })
  @IsUUID()
  public farmId!: string;

  @ApiProperty({
    description:
      "Client watermark timestamp in Unix epoch milliseconds when last pulled from server",
    example: 1726000000000,
  })
  @IsNumber()
  public lastPulledAt!: number;

  @ApiProperty({
    description:
      "Table changes map containing created, updated, and deleted entities recorded offline",
    example: {
      animals: { created: [], updated: [], deleted: [] },
      milkLogs: { created: [], updated: [] },
    },
  })
  @IsObject()
  public changes!: SyncPushTableChangesMap;
}
