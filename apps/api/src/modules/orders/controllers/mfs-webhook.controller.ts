import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Public, ResponseMessage } from "../../../common/decorators";
import {
  IMfsWebhookService,
  MFS_WEBHOOK_SERVICE,
  MfsIpnPayload,
  MfsWebhookResult,
} from "../services/mfs-webhook.service.interface";

@ApiTags("Orders Webhooks")
@Controller("orders/webhook")
export class MfsWebhookController {
  private readonly logger = new Logger(MfsWebhookController.name);

  constructor(
    @Inject(MFS_WEBHOOK_SERVICE)
    private readonly mfsWebhookService: IMfsWebhookService
  ) {}

  @Public()
  @Post("mfs")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Handle generic MFS IPN postback",
    description:
      "Validates cryptographic signature, checks amount integrity, and idempotently settles order status for regional mobile financial service callbacks.",
  })
  @ApiOkResponse({ description: "IPN postback processed or ignored safely." })
  @ApiBadRequestResponse({
    description: "Invalid signature or amount mismatch.",
  })
  @ResponseMessage("MFS IPN received.")
  public async handleGenericMfsIpn(
    @Body() payload: MfsIpnPayload,
    @Headers("x-mfs-signature") signatureHeader?: string,
    @Headers("x-trace-id") traceId?: string
  ): Promise<MfsWebhookResult> {
    return this.mfsWebhookService.processIpn(
      payload,
      signatureHeader,
      traceId
    );
  }

  @Public()
  @Post("sslcommerz")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Handle SSLCommerz IPN postback",
    description:
      "Normalizes SSLCommerz transaction parameters (tran_id, val_id, amount), verifies verify_sign hash, and updates order status.",
  })
  @ApiOkResponse({ description: "SSLCommerz IPN processed." })
  @ApiBadRequestResponse({
    description: "Invalid signature or amount mismatch.",
  })
  @ResponseMessage("SSLCommerz IPN received.")
  public async handleSslCommerzIpn(
    @Body() payload: Record<string, unknown>,
    @Headers("x-mfs-signature") signatureHeader?: string,
    @Headers("x-trace-id") traceId?: string
  ): Promise<MfsWebhookResult> {
    return this.mfsWebhookService.processSslCommerz(
      payload,
      signatureHeader,
      traceId
    );
  }

  @Public()
  @Post("bkash")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Handle bKash payment callback",
    description:
      "Normalizes bKash parameters (paymentID, trxID, amount), validates transactionStatus, and updates order status.",
  })
  @ApiOkResponse({ description: "bKash callback processed." })
  @ApiBadRequestResponse({
    description: "Invalid signature or amount mismatch.",
  })
  @ResponseMessage("bKash callback received.")
  public async handleBkashCallback(
    @Body() payload: Record<string, unknown>,
    @Headers("x-mfs-signature") signatureHeader?: string,
    @Headers("x-trace-id") traceId?: string
  ): Promise<MfsWebhookResult> {
    return this.mfsWebhookService.processBkash(
      payload,
      signatureHeader,
      traceId
    );
  }
}
