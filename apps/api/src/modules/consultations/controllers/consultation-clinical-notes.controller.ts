import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  ClinicalNoteDto,
  CreateClinicalNoteDto,
  JwtPayload,
  QueryClinicalNotesDto,
  UpdateClinicalNoteDto,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage, Roles } from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import {
  CONSULTATION_CLINICAL_NOTE_SERVICE,
  IConsultationClinicalNoteService,
} from "../services/consultation-clinical-note.service.interface";

@ApiTags("Tele-Veterinary - Clinical Notes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
@Controller("consultations")
export class ConsultationClinicalNotesController {
  constructor(
    @Inject(CONSULTATION_CLINICAL_NOTE_SERVICE)
    private readonly clinicalNoteService: IConsultationClinicalNoteService,
  ) {}

  @Post(":id/clinical-notes")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create private internal clinical note for consultation",
    description:
      "Records a confidential doctor-to-doctor note, differential diagnosis, or SOAP assessment for the consultation. Accessible only to attending veterinarians and administrators.",
  })
  @ApiOkResponse({
    description: "Clinical note created successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Confidential clinical notes are accessible only to attending veterinarians or administrators",
  })
  @ResponseMessage("Clinical note created successfully")
  public async createNote(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateClinicalNoteDto,
  ): Promise<ClinicalNoteDto> {
    return this.clinicalNoteService.createNote(
      id,
      user,
      dto,
      `user-${user.sub}`,
    );
  }

  @Get(":id/clinical-notes")
  @ApiOperation({
    summary: "Retrieve private internal clinical notes for consultation",
    description:
      "Fetches chronological clinical notes with optional category filtering and pagination. Hidden from farmers.",
  })
  @ApiOkResponse({
    description: "Clinical notes retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Confidential clinical notes are accessible only to attending veterinarians or administrators",
  })
  @ResponseMessage("Clinical notes retrieved successfully")
  public async getNotes(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryClinicalNotesDto,
  ): Promise<{
    items: ClinicalNoteDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.clinicalNoteService.getNotesByConsultation(id, user, query);
  }

  @Get(":id/clinical-notes/:noteId")
  @ApiOperation({
    summary: "Retrieve a specific private clinical note",
    description:
      "Fetches a single clinical note by its ID within the consultation dossier.",
  })
  @ApiOkResponse({
    description: "Clinical note retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Clinical note or consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Confidential clinical notes are accessible only to attending veterinarians or administrators",
  })
  @ResponseMessage("Clinical note retrieved successfully")
  public async getNoteById(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ClinicalNoteDto> {
    return this.clinicalNoteService.getNoteById(id, noteId, user);
  }

  @Patch(":id/clinical-notes/:noteId")
  @ApiOperation({
    summary: "Update an existing clinical note",
    description:
      "Modifies the title, content, category, or confidentiality of a clinical note. Permitted only to the author vet or an administrator.",
  })
  @ApiOkResponse({
    description: "Clinical note updated successfully",
  })
  @ApiNotFoundResponse({ description: "Clinical note or consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Only the author veterinarian or an administrator can modify this note",
  })
  @ResponseMessage("Clinical note updated successfully")
  public async updateNote(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateClinicalNoteDto,
  ): Promise<ClinicalNoteDto> {
    return this.clinicalNoteService.updateNote(
      id,
      noteId,
      user,
      dto,
      `user-${user.sub}`,
    );
  }

  @Delete(":id/clinical-notes/:noteId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete a clinical note",
    description:
      "Permanently removes a confidential clinical note. Permitted only to the author vet or an administrator.",
  })
  @ApiNotFoundResponse({ description: "Clinical note or consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Only the author veterinarian or an administrator can delete this note",
  })
  @ResponseMessage("Clinical note deleted successfully")
  public async deleteNote(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.clinicalNoteService.deleteNote(
      id,
      noteId,
      user,
      `user-${user.sub}`,
    );
  }
}
