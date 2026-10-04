import { ApiProperty } from "@nestjs/swagger";
import { CancelTriageCaseDto as ICancelTriageCaseDto } from "@vetralink/shared-types";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class CancelTriageCaseDto implements ICancelTriageCaseDto {
  @ApiProperty({
    description: "Clinical or administrative reason for cancelling the consultation request",
    minLength: 5,
    maxLength: 500,
    example: "Duplicate submission. Animal is already scheduled for an in-person emergency visit.",
  })
  @IsNotEmpty({ message: "Cancellation reason is required" })
  @IsString()
  @MinLength(5, { message: "Cancellation reason must be at least 5 characters long" })
  @MaxLength(500, { message: "Cancellation reason must not exceed 500 characters" })
  reason!: string;
}
