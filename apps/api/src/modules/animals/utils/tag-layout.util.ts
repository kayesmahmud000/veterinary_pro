import { TagBadgeLayout, TagBadgePageSize } from "@vetralink/shared-types";

export interface PageDimensions {
  width: number;
  height: number;
}

export interface GridCellBox {
  x: number;
  y: number; // Bottom-left coordinate in pdf-lib coordinate system
  width: number;
  height: number;
  colIndex: number;
  rowIndex: number;
}

export interface GridLayoutConfig {
  columns: number;
  rows: number;
  cellsPerPage: number;
  marginX: number;
  marginY: number;
  colGap: number;
  rowGap: number;
}

/**
 * Returns point dimensions for supported paper sizes (72 points = 1 inch).
 */
export function getPageDimensions(pageSize: TagBadgePageSize): PageDimensions {
  switch (pageSize) {
    case TagBadgePageSize.LETTER:
      return { width: 612.0, height: 792.0 };
    case TagBadgePageSize.A4:
    default:
      return { width: 595.28, height: 841.89 };
  }
}

/**
 * Returns grid configuration for specified layout.
 */
export function getGridLayoutConfig(layout: TagBadgeLayout): GridLayoutConfig {
  switch (layout) {
    case TagBadgeLayout.GRID_2X4:
      return {
        columns: 2,
        rows: 4,
        cellsPerPage: 8,
        marginX: 24,
        marginY: 30,
        colGap: 16,
        rowGap: 16,
      };
    case TagBadgeLayout.SINGLE_PER_PAGE:
      return {
        columns: 1,
        rows: 1,
        cellsPerPage: 1,
        marginX: 36,
        marginY: 36,
        colGap: 0,
        rowGap: 0,
      };
    case TagBadgeLayout.GRID_2X3:
    default:
      return {
        columns: 2,
        rows: 3,
        cellsPerPage: 6,
        marginX: 24,
        marginY: 30,
        colGap: 16,
        rowGap: 20,
      };
  }
}

/**
 * Calculates the bounding box of a cell in pdf-lib coordinates (bottom-left origin).
 */
export function calculateCellBox(
  indexOnPage: number,
  pageDim: PageDimensions,
  config: GridLayoutConfig
): GridCellBox {
  const colIndex = indexOnPage % config.columns;
  const rowIndex = Math.floor(indexOnPage / config.columns);

  const totalColGaps = (config.columns - 1) * config.colGap;
  const totalRowGaps = (config.rows - 1) * config.rowGap;

  const availableWidth = pageDim.width - 2 * config.marginX - totalColGaps;
  const availableHeight = pageDim.height - 2 * config.marginY - totalRowGaps;

  const cellWidth = availableWidth / config.columns;
  const cellHeight = availableHeight / config.rows;

  const x = config.marginX + colIndex * (cellWidth + config.colGap);

  // In pdf-lib, y=0 is at bottom of page.
  // Row 0 is at top of page, so its bottom-left y is:
  // pageHeight - marginY - cellHeight - (rowIndex * (cellHeight + rowGap))
  const y =
    pageDim.height -
    config.marginY -
    (rowIndex + 1) * cellHeight -
    rowIndex * config.rowGap;

  return {
    x,
    y,
    width: cellWidth,
    height: cellHeight,
    colIndex,
    rowIndex,
  };
}

/**
 * Calculates human-readable animal age string from Date of Birth.
 * e.g., "3y 2m", "8m", "14d"
 */
export function formatAnimalAge(
  dob: Date | string | null | undefined,
  referenceDate = new Date()
): string | null {
  if (!dob) return null;

  const birth = typeof dob === "string" ? new Date(dob) : dob;
  if (isNaN(birth.getTime())) return null;

  const diffMs = referenceDate.getTime() - birth.getTime();
  if (diffMs < 0) return "0d";

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 30) {
    return `${diffDays}d`;
  }

  let years = referenceDate.getUTCFullYear() - birth.getUTCFullYear();
  let months = referenceDate.getUTCMonth() - birth.getUTCMonth();
  const days = referenceDate.getUTCDate() - birth.getUTCDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0) {
    return `${Math.max(1, months)}m`;
  }

  return months > 0 ? `${years}y ${months}m` : `${years}y`;
}

/**
 * Calculates dynamic font size to prevent text from overflowing bounding width.
 */
export function getFittedFontSize(
  text: string,
  preferredSize: number,
  minSize: number,
  availableWidth: number,
  approxCharWidthFactor = 0.55
): number {
  if (!text || text.length === 0) return preferredSize;
  const estimatedWidth = text.length * preferredSize * approxCharWidthFactor;

  if (estimatedWidth <= availableWidth) {
    return preferredSize;
  }

  const scaledSize = Math.floor(availableWidth / (text.length * approxCharWidthFactor));
  return Math.max(minSize, scaledSize);
}

/**
 * Truncates text with ellipsis if it exceeds maximum characters.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

/**
 * Normalizes and sanitizes text strings to ASCII printable characters [0x20 - 0x7E],
 * decomposing Unicode diacritics to prevent WinAnsi standard font glyph encoding exceptions.
 */
export function sanitizeAsciiText(text: string | null | undefined, fallback = ""): string {
  if (!text || typeof text !== "string") {
    return fallback;
  }

  // Replace common unicode punctuation with ASCII equivalents
  const preprocessed = text
    .replace(/[•●]/g, "|")
    .replace(/[—–]/g, "-")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");

  // Decompose accented characters (e.g. é -> e, ü -> u)
  const normalized = preprocessed.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // Replace remaining non-ASCII printable characters with '?'
  const cleaned = normalized.replace(/[^\x20-\x7E]/g, "").trim();
  return cleaned.length > 0 ? cleaned : fallback;
}
