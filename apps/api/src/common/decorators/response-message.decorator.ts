import { SetMetadata, CustomDecorator } from "@nestjs/common";

export const RESPONSE_MESSAGE_METADATA = "RESPONSE_MESSAGE_METADATA";

export const ResponseMessage = (message: string): CustomDecorator<string> =>
  SetMetadata(RESPONSE_MESSAGE_METADATA, message);
