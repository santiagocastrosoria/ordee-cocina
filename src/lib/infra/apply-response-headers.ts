import type { NextRequest } from "next/server";
import { applyCorsHeaders } from "@/lib/infra/cors";
import { buildSecurityHeaders, staticAssetCacheHeader } from "@/lib/infra/security-headers";

export function applyInfraHeaders(request: NextRequest, responseHeaders: Headers): void {
  const securityHeaders = buildSecurityHeaders();

  for (const [key, value] of Object.entries(securityHeaders)) {
    responseHeaders.set(key, value);
  }

  applyCorsHeaders(responseHeaders, request.headers.get("origin"), request.url);

  const { pathname } = request.nextUrl;
  if (pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|woff2?)$/i)) {
    responseHeaders.set("Cache-Control", staticAssetCacheHeader());
  }
}
