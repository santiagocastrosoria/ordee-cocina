import { NextRequest, NextResponse } from "next/server";
import { applyInfraHeaders } from "@/lib/infra/apply-response-headers";
import { isAllowedCorsOrigin } from "@/lib/infra/cors";
import { checkRateLimit, rateLimitForPath } from "@/lib/infra/rate-limit";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  if (pathname.startsWith("/api/") && request.method === "OPTIONS") {
    if (origin && !isAllowedCorsOrigin(origin, request.url)) {
      return new NextResponse(null, { status: 403 });
    }

    const preflight = new NextResponse(null, { status: 204 });
    applyInfraHeaders(request, preflight.headers);
    return preflight;
  }

  const rateLimit = rateLimitForPath(pathname);
  if (rateLimit) {
    const ip =
      request.ip ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const result = checkRateLimit(`api:${ip}:${pathname}`, rateLimit.limit, rateLimit.windowMs);
    if (!result.success) {
      const limited = NextResponse.json({ error: "Too many requests" }, { status: 429 });
      limited.headers.set("Retry-After", String(Math.ceil((result.resetAt - Date.now()) / 1000)));
      applyInfraHeaders(request, limited.headers);
      return limited;
    }
  }

  const response = NextResponse.next();
  applyInfraHeaders(request, response.headers);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
