import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

// Language routing for the site pages only: prototypes, assets and files are left alone.
export const config = {
  matcher: ["/((?!api|_next|_vercel|prototype|proto|.*\..*).*)"],
};
