import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody, safeClientDbMessage } from "@/lib/api/http";
import { isUuid, sanitizeSlug, sanitizeText, validatePositivePrice } from "@/lib/api/sanitize";
import { requireStaffAuth } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

interface MenuMutationBody {
  action: "create" | "update" | "toggle" | "delete" | "create_category";
  id?: string;
  name?: string;
  description?: string;
  price_ars?: number;
  category_code?: string;
  is_active?: boolean;
  image_url?: string;
  category_name?: string;
}

async function getRestaurantAndCategories(client: SupabaseClient, restaurantId: string, slug: string) {
  const { data: categories, error } = await client.from("menu_categories").select("id,code").eq("restaurant_id", restaurantId);
  if (error) return null;
  return {
    restaurant: { id: restaurantId, slug },
    categories: categories ?? []
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireStaffAuth(request, "menu:read");
  if (!auth.ok) return auth.response;

  const { ctx } = auth;
  const context = await getRestaurantAndCategories(ctx.admin, ctx.restaurant.id, ctx.restaurant.slug);
  if (!context) return jsonError("Restaurante no encontrado", 404);

  const { data, error } = await ctx.admin
    .from("menu_items")
    .select("id,name,description,price_ars,is_active,image_url,category_id")
    .eq("restaurant_id", context.restaurant.id)
    .order("created_at", { ascending: true });

  if (error) {
    return jsonError("No se pudo cargar menu", 500, safeClientDbMessage("[staff/menu GET]", error));
  }

  const categoryById = new Map(context.categories.map((cat) => [cat.id, cat.code]));

  return NextResponse.json(
    (data ?? []).map((item) => ({
      ...item,
      category_code: categoryById.get(item.category_id) ?? "principal"
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffAuth(request, "menu:write");
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody<MenuMutationBody>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const { ctx } = auth;
  const context = await getRestaurantAndCategories(ctx.admin, ctx.restaurant.id, ctx.restaurant.slug);
  if (!context) {
    return jsonError("Restaurante no encontrado", 404);
  }

  if (body.action === "create") {
    const name = sanitizeText(body.name, 120);
    const price = validatePositivePrice(body.price_ars);
    const categoryId = context.categories.find((cat) => cat.code === body.category_code)?.id;
    if (!categoryId || !name || price === null) {
      return jsonError("Faltan datos", 400);
    }

    const { error } = await ctx.admin.from("menu_items").insert({
      restaurant_id: context.restaurant.id,
      category_id: categoryId,
      name,
      description: sanitizeText(body.description, 500) ?? "",
      price_ars: price,
      image_url: sanitizeText(body.image_url, 500),
      is_active: true
    });
    if (error) return jsonError("No se pudo crear", 500, safeClientDbMessage("[staff/menu create]", error));
  }

  if (body.action === "update") {
    if (!isUuid(body.id)) return jsonError("Falta id", 400);

    const { data: existing, error: fetchError } = await ctx.admin
      .from("menu_items")
      .select("restaurant_id")
      .eq("id", body.id)
      .maybeSingle();
    if (fetchError || !existing || existing.restaurant_id !== context.restaurant.id) {
      return jsonError("Producto no encontrado", 404);
    }

    const patch: Record<string, string | number | null> = {};
    const name = sanitizeText(body.name, 120);
    if (name) patch.name = name;
    if (typeof body.description === "string") patch.description = sanitizeText(body.description, 500) ?? "";
    const price = validatePositivePrice(body.price_ars);
    if (price !== null) patch.price_ars = price;
    if (typeof body.image_url === "string") patch.image_url = sanitizeText(body.image_url, 500);

    if (body.category_code) {
      const categoryId = context.categories.find((cat) => cat.code === body.category_code)?.id;
      if (categoryId) patch.category_id = categoryId;
    }

    if (Object.keys(patch).length === 0) {
      return jsonError("Nada que actualizar", 400);
    }

    const { error } = await ctx.admin
      .from("menu_items")
      .update(patch)
      .eq("id", body.id)
      .eq("restaurant_id", context.restaurant.id);
    if (error) return jsonError("No se pudo actualizar", 500, safeClientDbMessage("[staff/menu update]", error));
  }

  if (body.action === "toggle") {
    if (!isUuid(body.id) || typeof body.is_active !== "boolean") {
      return jsonError("Falta info para activar/desactivar", 400);
    }

    const { data: existing, error: fetchError } = await ctx.admin
      .from("menu_items")
      .select("restaurant_id")
      .eq("id", body.id)
      .maybeSingle();
    if (fetchError || !existing || existing.restaurant_id !== context.restaurant.id) {
      return jsonError("Producto no encontrado", 404);
    }

    const { error } = await ctx.admin
      .from("menu_items")
      .update({ is_active: body.is_active })
      .eq("id", body.id)
      .eq("restaurant_id", context.restaurant.id);
    if (error) return jsonError("No se pudo cambiar estado", 500, safeClientDbMessage("[staff/menu toggle]", error));
  }

  if (body.action === "delete") {
    if (!isUuid(body.id)) return jsonError("Falta id", 400);

    const { data: existing, error: fetchError } = await ctx.admin
      .from("menu_items")
      .select("restaurant_id")
      .eq("id", body.id)
      .maybeSingle();
    if (fetchError || !existing || existing.restaurant_id !== context.restaurant.id) {
      return jsonError("Producto no encontrado", 404);
    }

    const { error } = await ctx.admin
      .from("menu_items")
      .delete()
      .eq("id", body.id)
      .eq("restaurant_id", context.restaurant.id);
    if (error) return jsonError("No se pudo eliminar", 500, safeClientDbMessage("[staff/menu delete]", error));
  }

  if (body.action === "create_category") {
    const code = sanitizeText(body.category_code, 40)?.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const categoryName = sanitizeText(body.category_name, 80);
    if (!code || !categoryName) {
      return jsonError("Faltan datos de categoria", 400);
    }

    const { error } = await ctx.admin.from("menu_categories").insert({
      restaurant_id: context.restaurant.id,
      code,
      name: categoryName,
      sort_order: context.categories.length + 1
    });

    if (error) return jsonError("No se pudo crear categoria", 500, safeClientDbMessage("[staff/menu create_category]", error));
  }

  return NextResponse.json({ ok: true });
}
