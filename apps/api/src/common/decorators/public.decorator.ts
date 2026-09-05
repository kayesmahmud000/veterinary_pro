import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Decorator to explicitly mark route handlers or controllers as public,
 * bypassing authentication and authorization guards.
 *
 * @example
 * @Public()
 * @Post('login')
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
