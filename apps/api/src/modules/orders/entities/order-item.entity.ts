import * as crypto from "crypto";
import { OrderItemResponseDto } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface OrderItemProps {
  id: string;
  orderId: string;
  productId: string;
  productTitle?: string;
  priceCents: number;
  downloadToken: string;
  downloadCount: number;
  lastDownloadedAt: Date | null;
}

export interface CreateOrderItemProps {
  id?: string;
  orderId?: string;
  productId: string;
  productTitle?: string;
  priceCents: number;
  downloadToken?: string;
}

export class OrderItemEntity {
  private readonly _id: string;
  private _orderId: string;
  private readonly _productId: string;
  private _productTitle: string;
  private readonly _priceCents: number;
  private readonly _downloadToken: string;
  private _downloadCount: number;
  private _lastDownloadedAt: Date | null;

  private constructor(props: OrderItemProps) {
    this._id = props.id;
    this._orderId = props.orderId;
    this._productId = props.productId;
    this._productTitle = props.productTitle ?? "";
    this._priceCents = props.priceCents;
    this._downloadToken = props.downloadToken;
    this._downloadCount = props.downloadCount;
    this._lastDownloadedAt = props.lastDownloadedAt;
  }

  public static create(props: CreateOrderItemProps): OrderItemEntity {
    if (props.priceCents < 0) {
      throw new ValidationDomainException(
        "Order item priceCents cannot be negative."
      );
    }

    if (!props.productId) {
      throw new ValidationDomainException(
        "Order item requires a valid productId."
      );
    }

    return new OrderItemEntity({
      id: props.id ?? crypto.randomUUID(),
      orderId: props.orderId ?? "",
      productId: props.productId,
      productTitle: props.productTitle ?? "",
      priceCents: props.priceCents,
      downloadToken: props.downloadToken ?? crypto.randomUUID(),
      downloadCount: 0,
      lastDownloadedAt: null,
    });
  }

  public static reconstitute(props: OrderItemProps): OrderItemEntity {
    return new OrderItemEntity(props);
  }

  public get id(): string {
    return this._id;
  }

  public get orderId(): string {
    return this._orderId;
  }

  public setOrderId(orderId: string): void {
    this._orderId = orderId;
  }

  public get productId(): string {
    return this._productId;
  }

  public get productTitle(): string {
    return this._productTitle;
  }

  public setProductTitle(title: string): void {
    this._productTitle = title;
  }

  public get priceCents(): number {
    return this._priceCents;
  }

  public get downloadToken(): string {
    return this._downloadToken;
  }

  public get downloadCount(): number {
    return this._downloadCount;
  }

  public get lastDownloadedAt(): Date | null {
    return this._lastDownloadedAt;
  }

  public recordDownload(): void {
    this._downloadCount += 1;
    this._lastDownloadedAt = new Date();
  }

  public toResponse(): OrderItemResponseDto {
    return {
      id: this._id,
      productId: this._productId,
      productTitle: this._productTitle,
      priceCents: this._priceCents,
      downloadToken: this._downloadToken,
      downloadCount: this._downloadCount,
      lastDownloadedAt: this._lastDownloadedAt
        ? this._lastDownloadedAt.toISOString()
        : null,
    };
  }
}
