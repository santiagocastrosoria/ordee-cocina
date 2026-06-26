"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { nameFromEmail, TEMP_PASSWORD } from "@/lib/auth-temp";
import { displayNameForRestaurantSlug } from "@/lib/restaurant-demo";
import { staffPaths } from "@/lib/restaurant-routes";
import { getStaffSessionForSlug, setStaffSession } from "@/lib/session";

interface StaffLoginScreenProps {
  restaurantSlug: string;
  basePath: string;
}

export function StaffLoginScreen({ restaurantSlug, basePath }: StaffLoginScreenProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const allowedEmail = "scastrosoria@gmail.com";
  const paths = staffPaths(restaurantSlug);
  const panelPath = paths.panel;

  useEffect(() => {
    const session = getStaffSessionForSlug(restaurantSlug);
    if (session) {
      router.replace(panelPath);
    }
  }, [router, restaurantSlug, panelPath]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim().toLowerCase() !== allowedEmail) {
      setError("Acceso no autorizado");
      return;
    }
    if (password !== TEMP_PASSWORD) {
      setError("Contrasena incorrecta.");
      return;
    }

    setStaffSession({
      email: email.trim(),
      name: nameFromEmail(email),
      role: "staff",
      restaurantSlug,
      createdAt: new Date().toISOString()
    });
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
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={{ width: "100%", marginTop: 4 }} />
          </label>
          <label>
            Contrasena
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ width: "100%", marginTop: 4 }} />
          </label>
          {error ? <p style={{ color: "#f87171", margin: 0 }}>{error}</p> : null}
          <button type="submit">Ingresar</button>
        </form>
      </section>
    </main>
  );
}
