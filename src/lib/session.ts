"use client";

export interface StaffSession {
  email: string;
  name: string;
  role: "staff";
  createdAt: string;
}

const KEY = "ordee_cocina_session";

export function getStaffSession(): StaffSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StaffSession;
  } catch {
    return null;
  }
}

export function setStaffSession(session: StaffSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearStaffSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
