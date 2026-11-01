import { Body, CanActivate, Controller, HttpCode, Inject, Injectable, Post, Req, UseFilters, UseGuards } from "@nestjs/common";
import { ApiAcceptedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import {
  passwordResetAcknowledgementSchema, passwordResetCompleteSchema,
  passwordResetRequestSchema, passwordResetResultSchema,
  PasswordResetAcknowledgement, PasswordResetResult,
} from "@vetralink/shared-types";
import { Public, ResponseMessage } from "../../../common/decorators";
import { JwtAuthGuard } from "../../../common/guards";
import { EnvService } from "../../../config/env.service";
import { AccountRecoveryException, AccountRecoveryExceptionFilter } from "./account-recovery.errors";
import { PasswordResetCompleteDto, PasswordResetRequestDto, RecoveryValidationPipe } from "./account-recovery.dto";
import { ACCOUNT_RECOVERY_SERVICE, IAccountRecoveryService } from "./account-recovery.service.interface";

@Injectable()
export class AccountRecoveryEnabledGuard implements CanActivate {
  constructor(private readonly env: EnvService) {}
  canActivate(): boolean {
    if (!this.env.accountRecoveryEnabled) throw new AccountRecoveryException("RECOVERY_UNAVAILABLE");
    return true;
  }
}

@ApiTags("Account recovery")
@Controller("auth/password-reset")
@Public()
@UseGuards(JwtAuthGuard, AccountRecoveryEnabledGuard)
@UseFilters(AccountRecoveryExceptionFilter)
export class AccountRecoveryController {
  constructor(@Inject(ACCOUNT_RECOVERY_SERVICE) private readonly recovery: IAccountRecoveryService) {}

  @Post("request")
  @HttpCode(202)
  @ResponseMessage("Recovery request received.")
  @ApiOperation({ summary: "Request password recovery without disclosing account existence" })
  @ApiAcceptedResponse({ description: "Generic acknowledgement; does not confirm an account or delivery" })
  async request(
    @Body(new RecoveryValidationPipe(passwordResetRequestSchema)) input: PasswordResetRequestDto,
    @Req() request: Request,
  ): Promise<PasswordResetAcknowledgement> {
    const result = await this.recovery.request(input, {
      socketAddress: request.socket.remoteAddress, forwardedFor: request.headers["x-forwarded-for"],
    });
    return passwordResetAcknowledgementSchema.parse(result);
  }

  @Post("complete")
  @HttpCode(200)
  @ResponseMessage("Password reset completed.")
  @ApiOperation({ summary: "Consume a single-use reset credential without creating a session" })
  @ApiOkResponse({ description: "Password and session revocation committed" })
  async complete(
    @Body(new RecoveryValidationPipe(passwordResetCompleteSchema)) input: PasswordResetCompleteDto,
    @Req() request: Request,
  ): Promise<PasswordResetResult> {
    const result = await this.recovery.complete(input, {
      socketAddress: request.socket.remoteAddress, forwardedFor: request.headers["x-forwarded-for"],
    });
    return passwordResetResultSchema.parse(result);
  }
}
