import { Inject, Injectable } from "@nestjs/common";
import { JwtPayload } from "@vetralink/shared-types";
import {
  USER_REPOSITORY,
  IUserRepository,
} from "../../users/repositories/user.repository.interface";
import {
  UnauthorizedDomainException,
  WorkflowException,
} from "../../../common/exceptions/domain.exception";
import { EnvService } from "../../../config/env.service";

@Injectable()
export class CurrentIdentityService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    private readonly env: EnvService,
  ) {}
  public async resolve(claims: JwtPayload): Promise<JwtPayload> {
    const user = await this.users.findById(claims.sub);
    if (!user || user.isDeleted() || user.isSuspended())
      throw new UnauthorizedDomainException("User session is inactive.");
    if (claims.exp !== undefined && claims.exp * 1000 <= Date.now())
      throw new UnauthorizedDomainException("Access token expired.");
    const legacy = claims.authorizationVersion === undefined;
    const legacyAllowed =
      this.env.authLegacyClaimsUntil > Date.now() &&
      user.authorizationVersion === 0 &&
      claims.role === user.role;
    if (
      (legacy && !legacyAllowed) ||
      (!legacy && claims.authorizationVersion !== user.authorizationVersion)
    )
      throw new WorkflowException(
        "AUTHORIZATION_CHANGED",
        "Session permissions changed. Refresh or sign in again.",
        401,
      );
    return {
      ...claims,
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      authorizationVersion: user.authorizationVersion,
      farmerOnboardingRequired: user.farmerOnboardingRequired,
    };
  }
}
