import { CustomDecorator, SetMetadata } from "@nestjs/common";

export const ALLOW_READ_ONLY_KEY = "allowReadOnly";
export const AllowReadOnly = (): CustomDecorator<string> =>
  SetMetadata(ALLOW_READ_ONLY_KEY, true);

export const REQUIRE_WRITE_ACCESS_KEY = "requireWriteAccess";
export const RequireWriteAccess = (): CustomDecorator<string> =>
  SetMetadata(REQUIRE_WRITE_ACCESS_KEY, true);
