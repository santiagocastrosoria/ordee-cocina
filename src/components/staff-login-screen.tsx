"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { nameFromEmail } from "@/lib/auth-temp";
import { displayNameForRestaurantSlug } from "@/lib/restaurant-demo";
import { staffPaths } from "@/lib/restaurant-routes";
import { loadStaffProfile, signOutStaff, verifyStaffRestaurantAccess } from "@/lib/staff-client";
import { getSupabaseBrowserClient } from "@/lib/supabase";

interface StaffLoginScreenProps {
  restaurantSlug: string;
  basePath: string;
}

export function StaffLoginScreen({ restaurantSlug, basePath }: StaffLoginScreenProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const paths = staffPaths(restaurantSlug);
  const panelPath = paths.panel;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await loadStaffProfile(restaurantSlug);
      if (cancelled || !profile) return;
      const ok = await verifyStaffRestaurantAccess(restaurantSlug);
      if (!cancelled && ok) router.replace(panelPath);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, restaurantSlug, panelPath]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Faltan variables de Supabase en el entorno.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (signInError) {
      setError("Credenciales incorrectas.");
      setLoading(false);
      return;
    }

    const profile = await loadStaffProfile(restaurantSlug);
    if (!profile) {
      await signOutStaff();
      setError("Acceso no autorizado para staff.");
      setLoading(false);
      return;
    }

    const ok = await verifyStaffRestaurantAccess(restaurantSlug);
    if (!ok) {
      await signOutStaff();
      setError("No autorizado para este restaurante.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.replace(panelPath);
  };

  const restaurantName = displayNameForRestaurantSlug(restaurantSlug);

  return (
    <main>
      <section className="card" style={{ maxWidth: 450 }}>
        <h1 style={{ marginTop: 0 }}>ORDEE-Cocina Login</h1>
        {basePath ? <p style={{ fontWeight: 600, marginTop: 0 }}>{restaurantName}</p> : null}
        <p style={{ opacity: 0.8 }}>Ingresar staff para gestionar pedidos, caja y panel admin.</p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <label>
            Mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label>
            Contrasena
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          {error ? <p style={{ color: "#f87171", margin: 0 }}>{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
        <p style={{ fontSize: 12, opacity: 0.65, marginBottom: 0 }}>
          Demo: {nameFromEmail("dueno@ordee.demo")} o cocina@ordee.demo
        </p>
      </section>
    </main>
  );
}
