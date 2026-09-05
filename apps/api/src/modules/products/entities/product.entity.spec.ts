import { ProductType, SubscriptionTier } from "@vetralink/shared-types";
import { ProductEntity } from "./product.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("ProductEntity", () => {
  const validProps = {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Bovine Mastitis Protocol",
    slug: "bovine-mastitis-protocol",
    type: ProductType.VIDEO_COURSE,
    description: "Detailed video clinical protocol on dairy cow mastitis management.",
    priceCents: 5000,
    discountPriceCents: 4000,
    currency: "USD",
    contentS3Key: "courses/mastitis-v1/master.mp4",
    minSubscriptionTier: SubscriptionTier.STARTER,
    isPublished: true,
    metadata: { durationMinutes: 120 },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  it("should create and reconstitute a valid product entity", () => {
    const product = ProductEntity.reconstitute(validProps);

    expect(product.id).toBe(validProps.id);
    expect(product.title).toBe(validProps.title);
    expect(product.slug).toBe(validProps.slug);
    expect(product.type).toBe(ProductType.VIDEO_COURSE);
    expect(product.effectivePriceCents).toBe(4000);
    expect(product.isDiscounted()).toBe(true);
    expect(product.isFree()).toBe(false);
    expect(product.isActive()).toBe(true);
    expect(product.isVideo()).toBe(true);
  });

  it("should auto-generate kebab-case slug when creating without explicit slug", () => {
    const product = ProductEntity.create({
      title: "Advanced Herd ROI & Feed Formula! 2026",
      type: ProductType.EXCEL_TOOL,
      description: "Formula spreadsheet for calculating livestock rations.",
      priceCents: 3000,
      contentS3Key: "tools/feed-formula.xlsx",
    });

    expect(product.slug).toBe("advanced-herd-roi-feed-formula-2026");
    expect(product.isExcelTool()).toBe(true);
    expect(product.isPublished).toBe(false);
  });

  it("should throw ValidationDomainException if discount price is greater than or equal to price", () => {
    expect(() =>
      ProductEntity.create({
        title: "Dairy Guide",
        type: ProductType.EBOOK,
        description: "Comprehensive ebook on dairy husbandry.",
        priceCents: 2000,
        discountPriceCents: 2500,
        contentS3Key: "ebooks/dairy.pdf",
      })
    ).toThrow(ValidationDomainException);

    expect(() =>
      ProductEntity.create({
        title: "Dairy Guide",
        type: ProductType.EBOOK,
        description: "Comprehensive ebook on dairy husbandry.",
        priceCents: 2000,
        discountPriceCents: 2000,
        contentS3Key: "ebooks/dairy.pdf",
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if price is negative", () => {
    expect(() =>
      ProductEntity.create({
        title: "Dairy Guide",
        type: ProductType.EBOOK,
        description: "Comprehensive ebook on dairy husbandry.",
        priceCents: -500,
        contentS3Key: "ebooks/dairy.pdf",
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if slug has invalid characters", () => {
    expect(() =>
      ProductEntity.create({
        title: "Invalid Slug Product",
        slug: "invalid_slug_with_underscores",
        type: ProductType.VIDEO_COURSE,
        description: "Valid description of at least ten characters.",
        priceCents: 1000,
        contentS3Key: "video.mp4",
      })
    ).toThrow(ValidationDomainException);
  });

  it("should publish, unpublish, softDelete and restore product", () => {
    const product = ProductEntity.reconstitute({
      ...validProps,
      isPublished: false,
    });

    expect(product.isPublished).toBe(false);
    product.publish();
    expect(product.isPublished).toBe(true);
    product.unpublish();
    expect(product.isPublished).toBe(false);

    expect(product.isActive()).toBe(true);
    product.softDelete();
    expect(product.isActive()).toBe(false);
    expect(product.deletedAt).toBeInstanceOf(Date);

    product.restore();
    expect(product.isActive()).toBe(true);
    expect(product.deletedAt).toBeNull();
  });

  it("should format response with asset key only when requested", () => {
    const product = ProductEntity.reconstitute(validProps);

    const publicResp = product.toResponse(false);
    expect(publicResp.contentS3Key).toBeUndefined();

    const adminResp = product.toResponse(true);
    expect(adminResp.contentS3Key).toBe(validProps.contentS3Key);
  });
});
