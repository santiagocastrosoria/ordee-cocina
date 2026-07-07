import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeSlug } from "@/lib/api/sanitize";
import { getDefaultRestaurantSlug, getRestaurantBySlug } from "@/lib/restaurant-demo";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type ResolvedRestaurant = {
  id: string;
  slug: string;
  name: string;
};

export function restaurantSlugFromRequest(request: NextRequest): string {
  const fromQuery = sanitizeSlug(request.nextUrl.searchParams.get("restaurant"));
  return fromQuery ?? getDefaultRestaurantSlug();
}

export async function resolveRestaurantBySlug(
  slug: string,
  client?: SupabaseClient
): Promise<ResolvedRestaurant | null> {
  const clean = sanitizeSlug(slug) ?? slug.trim();
  if (!clean) return null;
  const supabase = client ?? createSupabaseAdmin();
  return getRestaurantBySlug(supabase, clean);
}

export async function resolveRestaurantFromRequest(
  request: NextRequest,
  client?: SupabaseClient
): Promise<ResolvedRestaurant | null> {
  return resolveRestaurantBySlug(restaurantSlugFromRequest(request), client);
}
