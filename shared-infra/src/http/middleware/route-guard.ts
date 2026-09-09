/**
 * @file route-guard.ts
 * @description Generic Public Route Inspector.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Declarative Endpoint Inspection:
 *    - Automatically bypasses internal Next.js assets (`/_next`), API endpoints (`/api`), static assets, and favicon (`/favicon.ico`).
 *    - Checks pathname against application-provided public routes array.
 */

import { HTTP_CONSTANTS } from "../constants";

export function isPublicRoute(
  pathname: string,
  publicRoutes: string[]
): boolean {
  if (
    pathname.startsWith(HTTP_CONSTANTS.PREFIX_NEXT) ||
    pathname.startsWith(HTTP_CONSTANTS.PREFIX_API) ||
    pathname.includes(".") ||
    pathname === HTTP_CONSTANTS.ENDPOINT_FAVICON
  ) {
    return true;
  }
  return publicRoutes.some((route) =>
    route === HTTP_CONSTANTS.ENDPOINT_ROOT ? pathname === HTTP_CONSTANTS.ENDPOINT_ROOT : pathname.startsWith(route)
  );
}
