import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class AnimalLineageQueryDto {
  @ApiPropertyOptional({
    description: "Maximum generations of ancestors to traverse (1 to 5)",
    default: 3,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  generations?: number = 3;
}
