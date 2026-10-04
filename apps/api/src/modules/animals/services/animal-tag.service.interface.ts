import {
  AnimalQrCodeDto,
  BatchTagBadgeRequestDto,
} from "@vetralink/shared-types";

export const ANIMAL_TAG_SERVICE = "ANIMAL_TAG_SERVICE";

export interface AnimalTagBadgeOptions {
  includePedigree?: boolean;
}

export interface IAnimalTagService {
  /**
   * Generates QR code metadata and base64 Data URL for an animal.
   */
  generateQrCode(farmId: string, animalId: string): Promise<AnimalQrCodeDto>;

  /**
   * Generates a raw PNG Buffer of the animal's QR code.
   */
  generateQrCodePngBuffer(
    farmId: string,
    animalId: string,
    size?: number
  ): Promise<{ buffer: Buffer; tagNumber: string }>;

  /**
   * Generates a single high-visibility printable placard / badge PDF.
   */
  generateSingleTagBadgePdf(
    farmId: string,
    animalId: string,
    options?: AnimalTagBadgeOptions
  ): Promise<{ buffer: Buffer; tagNumber: string }>;

  /**
   * Generates a multi-page printable grid sheet PDF (A4 or US Letter) for batch physical tagging.
   */
  generateBatchTagBadgesPdf(
    farmId: string,
    dto: BatchTagBadgeRequestDto
  ): Promise<{ buffer: Buffer; count: number }>;
}
