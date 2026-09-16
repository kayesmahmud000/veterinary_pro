import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { SubscriptionWebhookResultDto } from "@vetralink/shared-types";
import { Request } from "express";
import { Public, ResponseMessage } from "../../../common/decorators";
import {
  ISubscriptionWebhookService,
  SUBSCRIPTION_WEBHOOK_SERVICE,
} from "../services/subscription-webhook.service.interface";

@ApiTags("Subscriptions")
@Controller("subscriptions/webhook")
export class SubscriptionWebhookController {
  private readonly logger = new Logger(SubscriptionWebhookController.name);

  constructor(
    @Inject(SUBSCRIPTION_WEBHOOK_SERVICE)
    private readonly webhookService: ISubscriptionWebhookService,
  ) {}

  @Public()
  @Post("stripe")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Handle asynchronous Stripe subscription lifecycle webhook events",
    description:
      "Validates cryptographic HMAC-SHA256 signature from stripe-signature header against the raw body buffer and handles subscription renewals, payment failures, and cancellations.",
  })
  @ApiOkResponse({
    description: "Subscription webhook event processed or ignored safely.",
  })
  @ApiBadRequestResponse({
    description:
      "Invalid or missing stripe-signature header or malformed payload.",
  })
  @ResponseMessage("Subscription webhook processed.")
  public async handleStripeWebhook(
    @Headers("stripe-signature") signature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-trace-id") traceId?: string,
  ): Promise<SubscriptionWebhookResultDto> {
    if (!signature) {
      throw new BadRequestException("Missing stripe-signature header.");
    }

    const rawBody =
      req.rawBody ??
      (req.body
        ? Buffer.from(
            typeof req.body === "string"
              ? req.body
              : JSON.stringify(req.body),
            "utf-8",
          )
        : undefined);

    if (!rawBody) {
      throw new BadRequestException("Missing webhook request body.");
    }

    return this.webhookService.processWebhook(rawBody, signature, traceId);
  }
}
