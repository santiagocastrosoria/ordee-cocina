import { getAllowedOrigins } from "@/lib/infra/env";

export function isAllowedCorsOrigin(origin: string | null, requestUrl: string): boolean {
  if (!origin) return true;

  const allowed = new Set(getAllowedOrigins(origin));

  try {
    const requestOrigin = new URL(requestUrl).origin;
    allowed.add(requestOrigin);
  } catch {
    // ignorar
  }

  return allowed.has(origin);
}

export function applyCorsHeaders(response: Headers, origin: string | null, requestUrl: string): void {
  if (!origin || !isAllowedCorsOrigin(origin, requestUrl)) {
    return;
  }

  response.set("Access-Control-Allow-Origin", origin);
  response.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.set("Access-Control-Max-Age", "86400");
  response.set("Vary", "Origin");
}
