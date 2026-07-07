"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase";

export type StaffRole = "cocina" | "dueno";

export interface StaffProfile {
  role: StaffRole;
  full_name: string | null;
  restaurant_id: string;
}

export async function getStaffAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getStaffAuthHeaders(): Promise<Record<string, string> | null> {
  const token = await getStaffAccessToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

/** Carga la membresía staff del usuario para el restaurante activo (slug en URL). */
export async function loadStaffProfile(restaurantSlug: string): Promise<StaffProfile | null> {
  const headers = await getStaffAuthHeaders();
  if (!headers) return null;

  const response = await fetch(`/api/staff/me?restaurant=${encodeURIComponent(restaurantSlug)}`, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) return null;
  return (await response.json()) as StaffProfile;
}

export async function signOutStaff(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
}

/** Verifica JWT + tenant contra una ruta staff protegida. */
export async function verifyStaffRestaurantAccess(restaurantSlug: string): Promise<boolean> {
  const headers = await getStaffAuthHeaders();
  if (!headers) return false;

  const response = await fetch(`/api/staff/orders?restaurant=${encodeURIComponent(restaurantSlug)}`, {
    headers,
    cache: "no-store"
  });

  return response.ok;
}

export async function staffFetch(url: string, init?: RequestInit): Promise<Response | null> {
  const authHeaders = await getStaffAuthHeaders();
  if (!authHeaders) return null;

  const extraHeaders = init?.headers;
  const mergedHeaders: Record<string, string> = { ...authHeaders };
  if (extraHeaders instanceof Headers) {
    extraHeaders.forEach((value, key) => {
      mergedHeaders[key] = value;
    });
  } else if (Array.isArray(extraHeaders)) {
    for (const [key, value] of extraHeaders) {
      mergedHeaders[key] = value;
    }
  } else if (extraHeaders) {
    Object.assign(mergedHeaders, extraHeaders);
  }

  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: mergedHeaders
  });
}
