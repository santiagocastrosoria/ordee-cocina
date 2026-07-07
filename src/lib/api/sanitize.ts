const MAX_TEXT = 200;
const MAX_SLUG = 80;
const MAX_TABLE = 20;

export function sanitizeText(value: unknown, maxLen = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

export function sanitizeSlug(value: unknown): string | null {
  const text = sanitizeText(value, MAX_SLUG);
  if (!text) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(text)) return null;
  return text.toLowerCase();
}

export function sanitizeTableNumber(value: unknown): string | null {
  if (value == null || value === "") return null;
  return sanitizeText(value, MAX_TABLE);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function validatePositivePrice(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}
