"use client";

export interface StaffSession {
  email: string;
  name: string;
  role: "staff";
  restaurantSlug: string;
  createdAt: string;
}

const KEY = "ordee_cocina_session";

function normalizeSession(raw: unknown): StaffSession | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.email !== "string" ||
    typeof o.name !== "string" ||
    o.role !== "staff" ||
    typeof o.createdAt !== "string"
  ) {
    return null;
  }
  const restaurantSlug =
    typeof o.restaurantSlug === "string" && o.restaurantSlug.trim() !== "" ? o.restaurantSlug.trim() : "";
  if (!restaurantSlug) return null;
  return {
    email: o.email,
    name: o.name,
    role: "staff",
    restaurantSlug,
    createdAt: o.createdAt
  };
}

export function getStaffSession(): StaffSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return normalizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function getStaffSessionForSlug(restaurantSlug: string): StaffSession | null {
  const session = getStaffSession();
  if (!session) return null;
  if (session.restaurantSlug !== restaurantSlug.trim()) return null;
  return session;
}

export function setStaffSession(session: StaffSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearStaffSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
