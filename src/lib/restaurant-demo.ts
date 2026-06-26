import type { SupabaseClient } from "@supabase/supabase-js";

const LOG = "[ORDEE restaurant-demo]";

export const DEMO_RESTAURANT_NAME = "ORDEE Demo";

export function getDefaultRestaurantSlug(): string {
  const raw =
    typeof process !== "undefined"
      ? process.env.RESTAURANT_SLUG || process.env.NEXT_PUBLIC_RESTAURANT_SLUG || ""
      : "";
  const s = String(raw).trim();
  return s || "demo-ordee";
}

// Backward compatibility for older imports.
export function getRestaurantSlug(): string {
  return getDefaultRestaurantSlug();
}

export function displayNameForRestaurantSlug(slug: string): string {
  if (slug === "demo-ordee") return DEMO_RESTAURANT_NAME;
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Lookup READ-ONLY de un restaurante por slug. NUNCA inserta.
 * Usar en rutas staff públicas y layouts /r/[slug].
 */
export async function getRestaurantBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<{ id: string; slug: string; name: string } | null> {
  const clean = String(slug).trim();
  if (!clean) return null;

  const { data, error } = await supabase
    .from("restaurants")
    .select("id,slug,name")
    .eq("slug", clean)
    .maybeSingle();

  if (error) {
    console.error(LOG, "getRestaurantBySlug select falló slug=", clean, error.message);
    return null;
  }

  if (!data?.id) return null;

  return {
    id: data.id,
    slug: (data.slug as string) ?? clean,
    name: (data.name as string) ?? displayNameForRestaurantSlug(clean)
  };
}

export async function ensureRestaurantBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<
  | { ok: true; id: string; slug: string; created: boolean }
  | { ok: false; message: string; code?: string }
> {
  const name = displayNameForRestaurantSlug(slug);

  const { data: existing, error: findErr } = await supabase.from("restaurants").select("id,slug").eq("slug", slug).maybeSingle();

  if (findErr) {
    console.error(LOG, "select falló slug=", slug, findErr.message);
    return { ok: false, message: findErr.message, code: findErr.code };
  }

  if (existing?.id) {
    return { ok: true, id: existing.id, slug: existing.slug ?? slug, created: false };
  }

  console.info(LOG, "insert nuevo slug=", slug, "name=", name);

  const { data: inserted, error: insErr } = await supabase.from("restaurants").insert({ slug, name }).select("id,slug").single();

  if (!insErr && inserted?.id) {
    console.info(LOG, "creado OK restaurant_id=", inserted.id);
    return { ok: true, id: inserted.id, slug: inserted.slug ?? slug, created: true };
  }

  if (insErr?.code === "23505") {
    const { data: again } = await supabase.from("restaurants").select("id,slug").eq("slug", slug).maybeSingle();
    if (again?.id) {
      console.info(LOG, "race 23505, relectura OK restaurant_id=", again.id);
      return { ok: true, id: again.id, slug: again.slug ?? slug, created: false };
    }
  }

  console.error(LOG, "insert falló", insErr);
  return { ok: false, message: insErr?.message ?? "insert restaurants sin fila", code: insErr?.code };
}
