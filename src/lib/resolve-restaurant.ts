import type { NextRequest } from "next/server";
import { getDefaultRestaurantSlug, getRestaurantBySlug } from "@/lib/restaurant-demo";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type ResolvedRestaurant = {
  id: string;
  slug: string;
  name: string;
};

export function restaurantSlugFromRequest(request: NextRequest): string {
  const fromQuery = request.nextUrl.searchParams.get("restaurant")?.trim();
  return fromQuery || getDefaultRestaurantSlug();
}

export async function resolveRestaurantBySlug(slug: string): Promise<ResolvedRestaurant | null> {
  const clean = slug.trim();
  if (!clean) return null;
  const supabase = createSupabaseAdmin();
  return getRestaurantBySlug(supabase, clean);
}

export async function resolveRestaurantFromRequest(request: NextRequest): Promise<ResolvedRestaurant | null> {
  return resolveRestaurantBySlug(restaurantSlugFromRequest(request));
}
