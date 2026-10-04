import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as QRCode from "qrcode";
import {
  AnimalQrCodeDto,
  BatchTagBadgeRequestDto,
  TagBadgeLayout,
  TagBadgePageSize,
} from "@vetralink/shared-types";
import {
  AnimalTagBadgeOptions,
  IAnimalTagService,
} from "./animal-tag.service.interface";
import {
  ANIMAL_REPOSITORY,
  IAnimalRepository,
} from "../repositories/animal.repository.interface";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  calculateCellBox,
  formatAnimalAge,
  getFittedFontSize,
  getGridLayoutConfig,
  getPageDimensions,
  sanitizeAsciiText,
  truncateText,
} from "../utils/tag-layout.util";
import { AnimalEntity } from "../entities/animal.entity";

@Injectable()
export class AnimalTagService implements IAnimalTagService {
  private readonly logger = new Logger(AnimalTagService.name);
  private readonly baseUrl: string;

  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Optional()
    private readonly configService?: ConfigService
  ) {
    this.baseUrl =
      this.configService?.get<string>("APP_URL") ||
      this.configService?.get<string>("WEB_BASE_URL") ||
      "https://vetralink.pro";
  }

  public async generateQrCode(
    farmId: string,
    animalId: string
  ): Promise<AnimalQrCodeDto> {
    const animal = await this.animalRepository.findById(animalId, farmId);
    if (!animal) {
      throw new EntityNotFoundException(
        `Animal with ID '${animalId}' was not found in this farm.`,
        "animalId"
      );
    }

    const payload = this.buildAnimalUrl(farmId, animalId, animal.tagNumber);
    const qrCodeDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 300,
    });

    return {
      animalId,
      farmId,
      tagNumber: animal.tagNumber,
      qrCodeDataUrl,
      payload,
    };
  }

  public async generateQrCodePngBuffer(
    farmId: string,
    animalId: string,
    size = 300
  ): Promise<{ buffer: Buffer; tagNumber: string }> {
    const animal = await this.animalRepository.findById(animalId, farmId);
    if (!animal) {
      throw new EntityNotFoundException(
        `Animal with ID '${animalId}' was not found in this farm.`,
        "animalId"
      );
    }

    const payload = this.buildAnimalUrl(farmId, animalId, animal.tagNumber);
    const buffer = await QRCode.toBuffer(payload, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
    });

    return { buffer, tagNumber: animal.tagNumber };
  }

  public async generateSingleTagBadgePdf(
    farmId: string,
    animalId: string,
    options?: AnimalTagBadgeOptions
  ): Promise<{ buffer: Buffer; tagNumber: string }> {
    const animal = await this.animalRepository.findById(animalId, farmId);
    if (!animal) {
      throw new EntityNotFoundException(
        `Animal with ID '${animalId}' was not found in this farm.`,
        "animalId"
      );
    }

    const rawFarmName = (await this.animalRepository.getFarmName(farmId)) ?? "VetraLink Farm Herd";
    const farmName = sanitizeAsciiText(rawFarmName, "VetraLink Herd");

    // Standard 6" x 4" Placard (432 x 288 pt)
    const cardWidth = 432;
    const cardHeight = 288;

    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([cardWidth, cardHeight]);

    // Outer card border
    page.drawRectangle({
      x: 12,
      y: 12,
      width: cardWidth - 24,
      height: cardHeight - 24,
      borderColor: rgb(0.8, 0.83, 0.88),
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });

    // Top Header Banner
    const headerHeight = 36;
    page.drawRectangle({
      x: 12,
      y: cardHeight - 12 - headerHeight,
      width: cardWidth - 24,
      height: headerHeight,
      color: rgb(0.09, 0.35, 0.2), // Forest green #166534
    });

    // Farm Name in Header
    page.drawText(truncateText(farmName.toUpperCase(), 35), {
      x: 24,
      y: cardHeight - 34,
      size: 13,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    // Species & Status Badge on Right
    const speciesBadge = sanitizeAsciiText(`${animal.species} | ${animal.status}`);
    page.drawText(speciesBadge, {
      x: cardWidth - 24 - helveticaBold.widthOfTextAtSize(speciesBadge, 10),
      y: cardHeight - 33,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    // Generate high-res QR code PNG
    const qrBuffer = await this.generateQrPngBuffer(farmId, animalId, animal.tagNumber, 350);
    const qrImage = await pdfDoc.embedPng(qrBuffer);

    // Embed QR image on Right Panel
    const qrSize = 135;
    const qrX = cardWidth - 24 - qrSize - 12;
    const qrY = 70;
    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    });

    const qrCaption = "SCAN FOR ANIMAL RECORD";
    const qrCaptionWidth = helveticaBold.widthOfTextAtSize(qrCaption, 7);
    page.drawText(qrCaption, {
      x: qrX + (qrSize - qrCaptionWidth) / 2,
      y: qrY - 12,
      size: 7,
      font: helveticaBold,
      color: rgb(0.4, 0.45, 0.52),
    });

    // Left Panel: Animal Details
    const leftX = 26;
    let currentY = cardHeight - 12 - headerHeight - 20;

    // Subtitle: EAR TAG / IDENTIFIER
    page.drawText("EAR TAG / IDENTIFIER", {
      x: leftX,
      y: currentY,
      size: 8,
      font: helveticaBold,
      color: rgb(0.4, 0.45, 0.52),
    });

    currentY -= 28;
    const sanitizedTag = sanitizeAsciiText(animal.tagNumber);
    const tagFontSize = getFittedFontSize(sanitizedTag, 32, 18, 200);
    page.drawText(sanitizedTag, {
      x: leftX,
      y: currentY,
      size: tagFontSize,
      font: helveticaBold,
      color: rgb(0.07, 0.09, 0.15),
    });

    currentY -= 18;
    if (animal.name) {
      const nameText = sanitizeAsciiText(`Name: ${animal.name}`);
      page.drawText(truncateText(nameText, 30), {
        x: leftX,
        y: currentY,
        size: 10,
        font: helveticaBold,
        color: rgb(0.2, 0.25, 0.3),
      });
      currentY -= 16;
    }

    const breedText = sanitizeAsciiText(`Breed: ${animal.breed ?? "Unspecified"}`);
    page.drawText(truncateText(breedText, 30), {
      x: leftX,
      y: currentY,
      size: 10,
      font: helvetica,
      color: rgb(0.2, 0.25, 0.3),
    });

    currentY -= 16;
    const ageStr = formatAnimalAge(animal.dateOfBirth);
    const sexAgeText = sanitizeAsciiText(
      `Sex: ${animal.gender} | Age: ${ageStr ?? "N/A"}`
    );
    page.drawText(sexAgeText, {
      x: leftX,
      y: currentY,
      size: 10,
      font: helvetica,
      color: rgb(0.2, 0.25, 0.3),
    });

    currentY -= 16;
    if (animal.dateOfBirth) {
      const dobDate =
        animal.dateOfBirth instanceof Date
          ? animal.dateOfBirth.toISOString().split("T")[0]
          : String(animal.dateOfBirth).split("T")[0];
      page.drawText(sanitizeAsciiText(`DOB: ${dobDate}`), {
        x: leftX,
        y: currentY,
        size: 9,
        font: helvetica,
        color: rgb(0.35, 0.4, 0.45),
      });
      currentY -= 15;
    }

    if (animal.rfidNumber) {
      const rfidText = sanitizeAsciiText(`RFID: ${animal.rfidNumber}`);
      page.drawText(truncateText(rfidText, 32), {
        x: leftX,
        y: currentY,
        size: 9,
        font: helvetica,
        color: rgb(0.35, 0.4, 0.45),
      });
      currentY -= 15;
    }

    if (options?.includePedigree !== false) {
      const sireTag = animal.sire?.tagNumber ?? "-";
      const damTag = animal.dam?.tagNumber ?? "-";
      const pedigreeText = sanitizeAsciiText(`Sire: ${sireTag} | Dam: ${damTag}`);
      page.drawText(truncateText(pedigreeText, 35), {
        x: leftX,
        y: currentY,
        size: 8.5,
        font: helvetica,
        color: rgb(0.4, 0.45, 0.52),
      });
    }

    // Bottom Footer Separator Line
    page.drawLine({
      start: { x: 12, y: 34 },
      end: { x: cardWidth - 12, y: 34 },
      thickness: 0.75,
      color: rgb(0.85, 0.88, 0.92),
    });

    const footerText = sanitizeAsciiText(
      `VETRALINK PRO LIVESTOCK REGISTRY - Generated on ${new Date().toISOString().split("T")[0]}`
    );
    page.drawText(footerText, {
      x: 24,
      y: 20,
      size: 8,
      font: helvetica,
      color: rgb(0.5, 0.55, 0.6),
    });

    const pdfBytes = await pdfDoc.save();
    return {
      buffer: Buffer.from(pdfBytes),
      tagNumber: animal.tagNumber,
    };
  }

  public async generateBatchTagBadgesPdf(
    farmId: string,
    dto: BatchTagBadgeRequestDto
  ): Promise<{ buffer: Buffer; count: number }> {
    if (dto.animalIds && dto.animalIds.length > 100) {
      throw new ValidationDomainException(
        "Batch tag badge generation cannot exceed 100 animals per request."
      );
    }

    let animals: AnimalEntity[];
    if (dto.animalIds && dto.animalIds.length > 0) {
      animals = await this.animalRepository.findManyByIds(dto.animalIds, farmId);
    } else {
      const result = await this.animalRepository.findMany(farmId, {
        species: dto.species,
        status: dto.status,
        limit: 100,
        page: 1,
        sortBy: "tagNumber",
        sortOrder: "asc",
      });
      animals = result.items;
    }

    if (!animals || animals.length === 0) {
      throw new ValidationDomainException(
        "No animals found matching the specified criteria for tag badge generation."
      );
    }

    const rawFarmName = (await this.animalRepository.getFarmName(farmId)) ?? "VetraLink Herd";
    const farmName = sanitizeAsciiText(rawFarmName, "VetraLink Herd");

    const pageSize = dto.pageSize ?? TagBadgePageSize.A4;
    const layout = dto.layout ?? TagBadgeLayout.GRID_2X3;

    const pageDim = getPageDimensions(pageSize);
    const gridConfig = getGridLayoutConfig(layout);

    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const totalPages = Math.ceil(animals.length / gridConfig.cellsPerPage);
    const generatedDate = new Date().toISOString().split("T")[0];

    let currentPage = pdfDoc.addPage([pageDim.width, pageDim.height]);
    let currentPageIndex = 0;
    this.drawPageFooter(currentPage, 1, totalPages, farmName, generatedDate, helvetica, pageDim);

    for (let i = 0; i < animals.length; i++) {
      const animal = animals[i]!;
      const pageIndex = Math.floor(i / gridConfig.cellsPerPage);
      const indexOnPage = i % gridConfig.cellsPerPage;

      if (pageIndex > currentPageIndex) {
        currentPage = pdfDoc.addPage([pageDim.width, pageDim.height]);
        currentPageIndex = pageIndex;
        this.drawPageFooter(
          currentPage,
          currentPageIndex + 1,
          totalPages,
          farmName,
          generatedDate,
          helvetica,
          pageDim
        );
      }

      const cellBox = calculateCellBox(indexOnPage, pageDim, gridConfig);

      // Cell Border
      currentPage.drawRectangle({
        x: cellBox.x,
        y: cellBox.y,
        width: cellBox.width,
        height: cellBox.height,
        borderColor: rgb(0.8, 0.83, 0.88),
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      // Cell Header Banner
      const cellHeaderHeight = 22;
      currentPage.drawRectangle({
        x: cellBox.x,
        y: cellBox.y + cellBox.height - cellHeaderHeight,
        width: cellBox.width,
        height: cellHeaderHeight,
        color: rgb(0.09, 0.35, 0.2), // Forest green
      });

      // Header Text: Farm name & species
      currentPage.drawText(truncateText(farmName.toUpperCase(), 18), {
        x: cellBox.x + 8,
        y: cellBox.y + cellBox.height - 15,
        size: 8.5,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      const speciesText = sanitizeAsciiText(animal.species);
      currentPage.drawText(speciesText, {
        x: cellBox.x + cellBox.width - 8 - helveticaBold.widthOfTextAtSize(speciesText, 8),
        y: cellBox.y + cellBox.height - 15,
        size: 8,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      // Generate & Embed QR Code
      const qrBuffer = await this.generateQrPngBuffer(
        farmId,
        animal.id,
        animal.tagNumber,
        200
      );
      const qrImage = await pdfDoc.embedPng(qrBuffer);

      const maxQrSize = Math.min(cellBox.height - cellHeaderHeight - 16, 75);
      const qrX = cellBox.x + cellBox.width - maxQrSize - 8;
      const qrY = cellBox.y + (cellBox.height - cellHeaderHeight - maxQrSize) / 2;

      currentPage.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: maxQrSize,
        height: maxQrSize,
      });

      // Left Column Text in Cell
      const leftWidth = cellBox.width - maxQrSize - 20;
      const tagText = sanitizeAsciiText(animal.tagNumber);
      const tagFontSize = getFittedFontSize(tagText, 18, 11, leftWidth);

      let textY = cellBox.y + cellBox.height - cellHeaderHeight - tagFontSize - 4;
      currentPage.drawText(tagText, {
        x: cellBox.x + 8,
        y: textY,
        size: tagFontSize,
        font: helveticaBold,
        color: rgb(0.07, 0.09, 0.15),
      });

      textY -= 14;
      const breedStr = truncateText(
        sanitizeAsciiText(`Breed: ${animal.breed ?? "Unspecified"}`),
        22
      );
      currentPage.drawText(breedStr, {
        x: cellBox.x + 8,
        y: textY,
        size: 8,
        font: helvetica,
        color: rgb(0.3, 0.35, 0.4),
      });

      textY -= 12;
      const ageStr = formatAnimalAge(animal.dateOfBirth);
      const sexAgeStr = sanitizeAsciiText(
        `Sex: ${animal.gender} | Age: ${ageStr ?? "N/A"}`
      );
      currentPage.drawText(truncateText(sexAgeStr, 24), {
        x: cellBox.x + 8,
        y: textY,
        size: 7.5,
        font: helvetica,
        color: rgb(0.3, 0.35, 0.4),
      });

      if (animal.rfidNumber) {
        textY -= 11;
        const rfidStr = truncateText(
          sanitizeAsciiText(`RFID: ${animal.rfidNumber}`),
          24
        );
        currentPage.drawText(rfidStr, {
          x: cellBox.x + 8,
          y: textY,
          size: 7,
          font: helvetica,
          color: rgb(0.4, 0.45, 0.5),
        });
      }

      if (dto.includePedigree !== false) {
        textY -= 11;
        const sTag = animal.sire?.tagNumber ?? "-";
        const dTag = animal.dam?.tagNumber ?? "-";
        const pedStr = truncateText(
          sanitizeAsciiText(`S: ${sTag} | D: ${dTag}`),
          24
        );
        currentPage.drawText(pedStr, {
          x: cellBox.x + 8,
          y: textY,
          size: 7,
          font: helvetica,
          color: rgb(0.45, 0.5, 0.55),
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    return {
      buffer: Buffer.from(pdfBytes),
      count: animals.length,
    };
  }

  private drawPageFooter(
    page: ReturnType<PDFDocument["addPage"]>,
    pageNumber: number,
    totalPages: number,
    farmName: string,
    generatedDate: string,
    font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
    dim: { width: number; height: number }
  ): void {
    const footerText = sanitizeAsciiText(
      `Page ${pageNumber} of ${totalPages} - Farm: ${farmName} - Generated: ${generatedDate} - VetraLink Pro`
    );
    page.drawText(footerText, {
      x: 24,
      y: 12,
      size: 7.5,
      font,
      color: rgb(0.5, 0.55, 0.6),
    });
  }

  private buildAnimalUrl(farmId: string, animalId: string, tagNumber: string): string {
    return `${this.baseUrl}/farms/${farmId}/animals/${animalId}?tag=${encodeURIComponent(tagNumber)}`;
  }

  private async generateQrPngBuffer(
    farmId: string,
    animalId: string,
    tagNumber: string,
    size: number
  ): Promise<Buffer> {
    const payload = this.buildAnimalUrl(farmId, animalId, tagNumber);
    return QRCode.toBuffer(payload, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
    });
  }
}
