/** Hostname de Supabase para CSP connect-src (sin protocolo). */
export function getSupabaseHost(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  if (!raw.trim()) return undefined;

  try {
    return new URL(raw.trim()).host;
  } catch {
    return undefined;
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Orígenes permitidos para CORS (mismo deploy + URLs públicas configuradas). */
export function getAllowedOrigins(requestOrigin?: string | null): string[] {
  const origins = new Set<string>();

  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    requestOrigin
  ];

  for (const value of candidates) {
    if (!value?.trim()) continue;
    try {
      const url = new URL(value.trim().startsWith("http") ? value.trim() : `https://${value.trim()}`);
      origins.add(url.origin);
    } catch {
      // ignorar valores inválidos
    }
  }

  if (!isProduction()) {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:3010");
  }

  return [...origins];
}
