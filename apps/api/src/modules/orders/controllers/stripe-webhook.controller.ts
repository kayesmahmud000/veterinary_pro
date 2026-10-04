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
import { Request } from "express";
import { Public, ResponseMessage } from "../../../common/decorators";
import {
  IStripeWebhookService,
  STRIPE_WEBHOOK_SERVICE,
  WebhookProcessingResult,
} from "../services/stripe-webhook.service.interface";

@ApiTags("Orders Webhooks")
@Controller("orders/webhook")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    @Inject(STRIPE_WEBHOOK_SERVICE)
    private readonly stripeWebhookService: IStripeWebhookService
  ) {}

  @Public()
  @Post("stripe")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Handle asynchronous Stripe webhook events",
    description:
      "Validates cryptographic HMAC-SHA256 signature from stripe-signature header against the raw body buffer and idempotently settles order statuses.",
  })
  @ApiOkResponse({ description: "Webhook event processed or ignored safely." })
  @ApiBadRequestResponse({
    description: "Invalid or missing stripe-signature header or malformed payload.",
  })
  @ResponseMessage("Webhook received.")
  public async handleStripeWebhook(
    @Headers("stripe-signature") signature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-trace-id") traceId?: string
  ): Promise<WebhookProcessingResult> {
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
            "utf-8"
          )
        : undefined);

    if (!rawBody) {
      throw new BadRequestException("Missing webhook request body.");
    }

    return this.stripeWebhookService.processWebhook(
      rawBody,
      signature,
      traceId
    );
  }
}
