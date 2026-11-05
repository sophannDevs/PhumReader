import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next 16 renamed the `middleware` file convention to `proxy`.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and files with an extension (assets).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
