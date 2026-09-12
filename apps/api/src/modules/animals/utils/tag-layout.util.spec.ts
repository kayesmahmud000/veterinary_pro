import { TagBadgeLayout, TagBadgePageSize } from "@vetralink/shared-types";
import {
  calculateCellBox,
  formatAnimalAge,
  getFittedFontSize,
  getGridLayoutConfig,
  getPageDimensions,
  sanitizeAsciiText,
  truncateText,
} from "./tag-layout.util";

describe("TagLayoutUtil", () => {
  describe("getPageDimensions", () => {
    it("should return correct dimensions for A4", () => {
      const dim = getPageDimensions(TagBadgePageSize.A4);
      expect(dim.width).toBeCloseTo(595.28, 1);
      expect(dim.height).toBeCloseTo(841.89, 1);
    });

    it("should return correct dimensions for LETTER", () => {
      const dim = getPageDimensions(TagBadgePageSize.LETTER);
      expect(dim.width).toBe(612.0);
      expect(dim.height).toBe(792.0);
    });
  });

  describe("getGridLayoutConfig", () => {
    it("should return 6 cells for GRID_2X3", () => {
      const config = getGridLayoutConfig(TagBadgeLayout.GRID_2X3);
      expect(config.columns).toBe(2);
      expect(config.rows).toBe(3);
      expect(config.cellsPerPage).toBe(6);
    });

    it("should return 8 cells for GRID_2X4", () => {
      const config = getGridLayoutConfig(TagBadgeLayout.GRID_2X4);
      expect(config.columns).toBe(2);
      expect(config.rows).toBe(4);
      expect(config.cellsPerPage).toBe(8);
    });

    it("should return 1 cell for SINGLE_PER_PAGE", () => {
      const config = getGridLayoutConfig(TagBadgeLayout.SINGLE_PER_PAGE);
      expect(config.columns).toBe(1);
      expect(config.rows).toBe(1);
      expect(config.cellsPerPage).toBe(1);
    });
  });

  describe("calculateCellBox", () => {
    it("should calculate cell boxes correctly on A4 2x3 grid", () => {
      const pageDim = getPageDimensions(TagBadgePageSize.A4);
      const config = getGridLayoutConfig(TagBadgeLayout.GRID_2X3);

      const cell0 = calculateCellBox(0, pageDim, config);
      expect(cell0.colIndex).toBe(0);
      expect(cell0.rowIndex).toBe(0);
      expect(cell0.x).toBe(config.marginX);
      expect(cell0.width).toBeGreaterThan(200);
      expect(cell0.height).toBeGreaterThan(200);

      const cell1 = calculateCellBox(1, pageDim, config);
      expect(cell1.colIndex).toBe(1);
      expect(cell1.rowIndex).toBe(0);
      expect(cell1.x).toBeGreaterThan(cell0.x);

      const cell2 = calculateCellBox(2, pageDim, config);
      expect(cell2.colIndex).toBe(0);
      expect(cell2.rowIndex).toBe(1);
      // y coordinate in pdf-lib decreases as we go down the page
      expect(cell2.y).toBeLessThan(cell0.y);
    });
  });

  describe("formatAnimalAge", () => {
    const refDate = new Date("2026-06-01T00:00:00Z");

    it("should return null for undefined or null date", () => {
      expect(formatAnimalAge(null)).toBeNull();
      expect(formatAnimalAge(undefined)).toBeNull();
    });

    it("should return days for young animals (< 30 days)", () => {
      const dob = new Date("2026-05-20T00:00:00Z");
      expect(formatAnimalAge(dob, refDate)).toBe("12d");
    });

    it("should return months for animals under 1 year", () => {
      const dob = new Date("2026-01-01T00:00:00Z");
      expect(formatAnimalAge(dob, refDate)).toBe("5m");
    });

    it("should return years and remaining months for mature animals", () => {
      const dob = new Date("2024-03-01T00:00:00Z");
      expect(formatAnimalAge(dob, refDate)).toBe("2y 3m");
    });
  });

  describe("getFittedFontSize", () => {
    it("should return preferred size when text easily fits", () => {
      const size = getFittedFontSize("COW-100", 32, 18, 200);
      expect(size).toBe(32);
    });

    it("should scale down font size when text is long", () => {
      const size = getFittedFontSize("VERY-LONG-INTERNATIONAL-RFID-TAG-9999", 32, 14, 150);
      expect(size).toBeLessThan(32);
      expect(size).toBeGreaterThanOrEqual(14);
    });
  });

  describe("truncateText", () => {
    it("should not truncate short text", () => {
      expect(truncateText("Holstein", 15)).toBe("Holstein");
    });

    it("should truncate long text and append ellipsis", () => {
      expect(truncateText("Holstein Friesian Crossbreed Special", 10)).toBe("Holstein ...");
    });
  });

  describe("sanitizeAsciiText", () => {
    it("should decompose accented characters to ASCII", () => {
      expect(sanitizeAsciiText("Café Brügger")).toBe("Cafe Brugger");
    });

    it("should replace unicode bullets and dashes with ASCII equivalents", () => {
      expect(sanitizeAsciiText("COW • ACTIVE — HIGH")).toBe("COW | ACTIVE - HIGH");
    });

    it("should return fallback when input is empty", () => {
      expect(sanitizeAsciiText("", "N/A")).toBe("N/A");
      expect(sanitizeAsciiText(null, "Fallback")).toBe("Fallback");
    });
  });
});
