import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class QuerySubscriptionPlansDto {
  @ApiPropertyOptional({
    description: "Whether to include inactive/archived plans",
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true || value === 1 || value === "1") {
      return true;
    }
    if (value === "false" || value === false || value === 0 || value === "0") {
      return false;
    }
    return undefined;
  })
  includeInactive?: boolean = false;
}
