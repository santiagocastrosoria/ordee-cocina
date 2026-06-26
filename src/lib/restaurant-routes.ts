import { getDefaultRestaurantSlug } from "@/lib/restaurant-demo";

const SCOPED_PREFIX = /^\/r\/([^/]+)/;

export function parseRestaurantSlugFromPath(pathname: string): string | null {
  const match = pathname.match(SCOPED_PREFIX);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1]).trim() || null;
}

/** Route prefix: "" for flat demo, "/r/clarkes" for scoped staff. */
export function staffBasePathForSlug(slug: string): string {
  const clean = slug.trim();
  if (!clean || clean === getDefaultRestaurantSlug()) return "";
  return `/r/${encodeURIComponent(clean)}`;
}

export function staffPaths(slug: string) {
  const base = staffBasePathForSlug(slug);
  return {
    login: base || "/",
    panel: `${base}/panel`
  };
}

/** True on flat `/` or exact `/r/[slug]` login landing. */
export function isStaffLoginPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login") return true;
  const slug = parseRestaurantSlugFromPath(pathname);
  if (!slug) return false;
  const encoded = encodeURIComponent(slug);
  return pathname === `/r/${encoded}` || pathname === `/r/${slug}`;
}
