import { NextRequest, NextResponse } from "next/server";
import { resolveRestaurantBySlug, resolveRestaurantFromRequest } from "@/lib/resolve-restaurant";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

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

async function getRestaurantAndCategories(supabase: ReturnType<typeof createSupabaseAdmin>, slug: string) {
  const restaurant = await resolveRestaurantBySlug(slug);
  if (!restaurant) return null;

  const { data: categories } = await supabase.from("menu_categories").select("id,code").eq("restaurant_id", restaurant.id);
  return { restaurant, categories: categories ?? [] };
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("restaurant");
  if (!slug) {
    return NextResponse.json({ error: "Falta restaurant" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const context = await getRestaurantAndCategories(supabase, slug);
  if (!context) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  const { data } = await supabase
    .from("menu_items")
    .select("id,name,description,price_ars,is_active,image_url,category_id")
    .eq("restaurant_id", context.restaurant.id)
    .order("created_at", { ascending: true });

  const categoryById = new Map(context.categories.map((cat) => [cat.id, cat.code]));

  return NextResponse.json(
    (data ?? []).map((item) => ({
      ...item,
      category_code: categoryById.get(item.category_id) ?? "principal"
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as MenuMutationBody;
  const supabase = createSupabaseAdmin();
  const restaurant = await resolveRestaurantFromRequest(request);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const context = await getRestaurantAndCategories(supabase, restaurant.slug);
  if (!context) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  if (body.action === "create") {
    const categoryId = context.categories.find((cat) => cat.code === body.category_code)?.id;
    if (!categoryId || !body.name || !body.price_ars) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }
    const { error } = await supabase.from("menu_items").insert({
      restaurant_id: context.restaurant.id,
      category_id: categoryId,
      name: body.name,
      description: body.description ?? "",
      price_ars: body.price_ars,
      image_url: body.image_url ?? null,
      is_active: true
    });
    if (error) return NextResponse.json({ error: "No se pudo crear" }, { status: 500 });
  }

  if (body.action === "update") {
    if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    const { data: existing } = await supabase
      .from("menu_items")
      .select("restaurant_id")
      .eq("id", body.id)
      .maybeSingle();
    if (!existing || existing.restaurant_id !== context.restaurant.id) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const patch: Record<string, string | number> = {};
    if (body.name) patch.name = body.name;
    if (typeof body.description === "string") patch.description = body.description;
    if (typeof body.price_ars === "number") patch.price_ars = body.price_ars;
    if (typeof body.image_url === "string") patch.image_url = body.image_url;

    if (body.category_code) {
      const categoryId = context.categories.find((cat) => cat.code === body.category_code)?.id;
      if (categoryId) patch.category_id = categoryId;
    }

    const { error } = await supabase.from("menu_items").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }

  if (body.action === "toggle") {
    if (!body.id || typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "Falta info para activar/desactivar" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("menu_items")
      .select("restaurant_id")
      .eq("id", body.id)
      .maybeSingle();
    if (!existing || existing.restaurant_id !== context.restaurant.id) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const { error } = await supabase.from("menu_items").update({ is_active: body.is_active }).eq("id", body.id);
    if (error) return NextResponse.json({ error: "No se pudo cambiar estado" }, { status: 500 });
  }

  if (body.action === "delete") {
    if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    const { data: existing } = await supabase
      .from("menu_items")
      .select("restaurant_id")
      .eq("id", body.id)
      .maybeSingle();
    if (!existing || existing.restaurant_id !== context.restaurant.id) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const { error } = await supabase.from("menu_items").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: "No se pudo eliminar" }, { status: 500 });
  }

  if (body.action === "create_category") {
    if (!body.category_code || !body.category_name) {
      return NextResponse.json({ error: "Faltan datos de categoria" }, { status: 400 });
    }

    const { error } = await supabase.from("menu_categories").insert({
      restaurant_id: context.restaurant.id,
      code: body.category_code,
      name: body.category_name,
      sort_order: context.categories.length + 1
    });

    if (error) return NextResponse.json({ error: "No se pudo crear categoria" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
