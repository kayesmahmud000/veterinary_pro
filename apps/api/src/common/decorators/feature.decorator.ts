import { SetMetadata } from "@nestjs/common";

export const REQUIRE_FEATURE_KEY = "REQUIRE_FEATURE_KEY";

export const RequireFeature = (feature: string) =>
  SetMetadata(REQUIRE_FEATURE_KEY, feature);
