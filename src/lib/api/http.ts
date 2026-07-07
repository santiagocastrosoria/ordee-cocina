import { NextResponse } from "next/server";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function jsonError(message: string, status: number, detail?: string): NextResponse {
  const body: Record<string, string> = { error: message };
  if (detail && !isProduction()) {
    body.detail = detail;
  }
  return NextResponse.json(body, { status });
}

export async function parseJsonBody<T>(
  request: Request
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, response: jsonError("Body JSON invalido", 400) };
  }
}

export function logRouteError(tag: string, message: string, error: unknown): void {
  console.error(tag, message, error instanceof Error ? error.message : error);
}

export function safeClientDbMessage(context: string, error: { message?: string }): string {
  logRouteError(context, "db error", error);
  return isProduction() ? "Error interno del servidor" : error.message ?? "Error de base de datos";
}
