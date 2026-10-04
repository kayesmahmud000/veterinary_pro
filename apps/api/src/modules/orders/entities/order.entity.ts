import * as crypto from "crypto";
import {
  OrderDetailResponseDto,
  OrderStatus,
} from "@vetralink/shared-types";
import { OrderItemEntity } from "./order-item.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface OrderProps {
  id: string;
  userId: string;
  totalCents: number;
  currency: string;
  status: OrderStatus;
  paymentGateway: string;
  gatewayTxId: string | null;
  items?: OrderItemEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderProps {
  id?: string;
  userId: string;
  totalCents: number;
  currency?: string;
  status?: OrderStatus;
  paymentGateway?: string;
  gatewayTxId?: string | null;
  items?: OrderItemEntity[];
}

export class OrderEntity {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _totalCents: number;
  private readonly _currency: string;
  private _status: OrderStatus;
  private readonly _paymentGateway: string;
  private _gatewayTxId: string | null;
  private _items: OrderItemEntity[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: OrderProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._totalCents = props.totalCents;
    this._currency = props.currency;
    this._status = props.status;
    this._paymentGateway = props.paymentGateway;
    this._gatewayTxId = props.gatewayTxId;
    this._items = props.items ?? [];
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(props: CreateOrderProps): OrderEntity {
    if (props.totalCents < 0) {
      throw new ValidationDomainException(
        "Order totalCents cannot be negative."
      );
    }

    if (!props.userId) {
      throw new ValidationDomainException("Order requires a valid userId.");
    }

    const orderId = props.id ?? crypto.randomUUID();
    const items = props.items ?? [];
    items.forEach((item) => item.setOrderId(orderId));

    return new OrderEntity({
      id: orderId,
      userId: props.userId,
      totalCents: props.totalCents,
      currency: props.currency ?? "USD",
      status: props.status ?? OrderStatus.PENDING,
      paymentGateway: props.paymentGateway ?? "stripe",
      gatewayTxId: props.gatewayTxId ?? null,
      items,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public static reconstitute(props: OrderProps): OrderEntity {
    return new OrderEntity(props);
  }

  public get id(): string {
    return this._id;
  }

  public get userId(): string {
    return this._userId;
  }

  public get totalCents(): number {
    return this._totalCents;
  }

  public get currency(): string {
    return this._currency;
  }

  public get status(): OrderStatus {
    return this._status;
  }

  public get paymentGateway(): string {
    return this._paymentGateway;
  }

  public get gatewayTxId(): string | null {
    return this._gatewayTxId;
  }

  public setGatewayTxId(txId: string): void {
    this._gatewayTxId = txId;
    this._updatedAt = new Date();
  }

  public get items(): OrderItemEntity[] {
    return [...this._items];
  }

  public setItems(items: OrderItemEntity[]): void {
    this._items = [...items];
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public markCompleted(gatewayTxId?: string): void {
    if (this._status === OrderStatus.COMPLETED) {
      return;
    }
    this._status = OrderStatus.COMPLETED;
    if (gatewayTxId) {
      this._gatewayTxId = gatewayTxId;
    }
    this._updatedAt = new Date();
  }

  public markFailed(): void {
    this._status = OrderStatus.FAILED;
    this._updatedAt = new Date();
  }

  public toDetailResponse(): OrderDetailResponseDto {
    return {
      id: this._id,
      userId: this._userId,
      totalCents: this._totalCents,
      currency: this._currency,
      status: this._status,
      paymentGateway: this._paymentGateway,
      gatewayTxId: this._gatewayTxId,
      items: this._items.map((item) => item.toResponse()),
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
