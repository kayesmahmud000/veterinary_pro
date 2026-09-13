import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class ConfirmAttachmentUploadDto {
  @ApiPropertyOptional({
    description: "Optional notes or clinical caption for the lesion image",
    example: "Wound cleaned and dressed post-inspection",
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public caption?: string;
}
