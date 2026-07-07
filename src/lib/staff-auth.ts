import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/http";
import { getAdminClientOrResponse } from "@/lib/api/supabase-route";
import { resolveRestaurantFromRequest, type ResolvedRestaurant } from "@/lib/resolve-restaurant";

export type StaffRole = "cocina" | "dueno";

export type StaffPermission =
  | "orders:read"
  | "orders:write"
  | "orders:delete"
  | "metrics:read"
  | "menu:read"
  | "menu:write"
  | "tables:read"
  | "tables:write"
  | "help:read"
  | "help:write";

const ROLE_PERMISSIONS: Record<StaffRole, readonly StaffPermission[]> = {
  cocina: ["orders:read", "orders:write", "help:read", "help:write"],
  dueno: [
    "orders:read",
    "orders:write",
    "orders:delete",
    "metrics:read",
    "menu:read",
    "menu:write",
    "tables:read",
    "tables:write",
    "help:read",
    "help:write"
  ]
};

export interface StaffProfile {
  id: string;
  role: StaffRole;
  restaurant_id: string;
  full_name: string | null;
}

export interface StaffAuthContext {
  userId: string;
  profile: StaffProfile;
  restaurant: ResolvedRestaurant;
  admin: SupabaseClient;
}

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function isStaffRole(role: string): role is StaffRole {
  return role === "cocina" || role === "dueno";
}

type StaffRestaurantClaim = { slug: string; role: string };

function roleFromAppMetadata(user: { app_metadata?: Record<string, unknown> }, slug: string): StaffRole | null {
  const raw = user.app_metadata?.staff_restaurants;
  if (!Array.isArray(raw)) return null;
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const claim = entry as StaffRestaurantClaim;
    if (claim.slug === slug && isStaffRole(claim.role)) {
      return claim.role;
    }
  }
  return null;
}

async function resolveStaffRoleForRestaurant(
  admin: SupabaseClient,
  userId: string,
  user: { app_metadata?: Record<string, unknown> },
  restaurant: ResolvedRestaurant
): Promise<{ role: StaffRole; full_name: string | null } | null> {
  const { data: membership, error: membershipError } = await admin
    .from("staff_restaurant_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  if (!membershipError && membership && isStaffRole(membership.role)) {
    const { data: profileRow } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    return { role: membership.role, full_name: profileRow?.full_name ?? null };
  }

  const metadataRole = roleFromAppMetadata(user, restaurant.slug);
  if (metadataRole) {
    const { data: profileRow } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    return { role: metadataRole, full_name: profileRow?.full_name ?? null };
  }

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .select("role, restaurant_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (
    profileError ||
    !profileRow ||
    !isStaffRole(profileRow.role) ||
    !profileRow.restaurant_id ||
    profileRow.restaurant_id !== restaurant.id
  ) {
    return null;
  }

  return { role: profileRow.role, full_name: profileRow.full_name };
}

export async function requireStaffAuth(
  request: NextRequest,
  permission: StaffPermission
): Promise<{ ok: true; ctx: StaffAuthContext } | { ok: false; response: NextResponse }> {
  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false, response: jsonError("No autorizado", 401) };
  }

  const adminResult = getAdminClientOrResponse();
  if (!adminResult.ok) {
    return { ok: false, response: adminResult.response };
  }

  const { data: userData, error: userError } = await adminResult.client.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, response: jsonError("No autorizado", 401) };
  }

  const restaurant = await resolveRestaurantFromRequest(request, adminResult.client);
  if (!restaurant) {
    return { ok: false, response: jsonError("Restaurante no encontrado", 404) };
  }

  const resolved = await resolveStaffRoleForRestaurant(
    adminResult.client,
    userData.user.id,
    userData.user,
    restaurant
  );

  if (!resolved) {
    return { ok: false, response: jsonError("Acceso denegado", 403) };
  }

  const { role, full_name: fullName } = resolved;
  if (!ROLE_PERMISSIONS[role].includes(permission)) {
    return { ok: false, response: jsonError("Acceso denegado", 403) };
  }

  return {
    ok: true,
    ctx: {
      userId: userData.user.id,
      profile: {
        id: userData.user.id,
        role,
        restaurant_id: restaurant.id,
        full_name: fullName
      },
      restaurant,
      admin: adminResult.client
    }
  };
}
