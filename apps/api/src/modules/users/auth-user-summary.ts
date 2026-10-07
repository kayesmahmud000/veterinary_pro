import { AuthUserSummary } from "@vetralink/shared-types";
import { UserEntity } from "./entities/user.entity";
export function toAuthUserSummary(user: UserEntity): AuthUserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    isEmailVerified: user.isEmailVerified,
    maskedPhone: user.maskPhone(),
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    roleVersion: user.roleVersion,
    farmerOnboardingRequired: user.farmerOnboardingRequired,
  };
}
