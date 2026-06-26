import { notFound } from "next/navigation";
import { getDefaultRestaurantSlug, getRestaurantBySlug } from "@/lib/restaurant-demo";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export default async function RestaurantScopeLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { restaurantSlug: string };
}) {
  const slug = decodeURIComponent(params.restaurantSlug).trim();
  const isDefaultDemo = slug === getDefaultRestaurantSlug();

  let allowed = isDefaultDemo;

  if (!allowed) {
    try {
      const supabase = createSupabaseAdmin();
      const restaurant = await getRestaurantBySlug(supabase, slug);
      allowed = Boolean(restaurant);
    } catch (e) {
      console.error("[ORDEE-COCINA /r layout] no se pudo validar slug=", slug, e instanceof Error ? e.message : e);
      allowed = isDefaultDemo;
    }
  }

  if (!allowed) {
    notFound();
  }

  return <>{children}</>;
}
