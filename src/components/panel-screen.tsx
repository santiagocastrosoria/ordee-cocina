"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { displayNameForRestaurantSlug } from "@/lib/restaurant-demo";
import { staffPaths } from "@/lib/restaurant-routes";
import { clearStaffSession, getStaffSessionForSlug } from "@/lib/session";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type ViewKey = "cocina" | "caja" | "dueno" | "menu" | "mesas";

type OrderRow = {
  id: string;
  customer_name: string;
  table_number: string | null;
  notes: string | null;
  status: "nuevo" | "preparando" | "listo" | "entregado" | "cancelado";
  payment_status: "pendiente" | "pagado" | "fallido";
  payment_method: string;
  total_ars: number;
  created_at: string;
  order_items: Array<{ item_name: string; quantity: number; unit_price_ars: number }>;
};

type Metrics = {
  dailyRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  ordersCount: number;
  avgTicket: number;
  paymentMethods: Record<string, number>;
  paidToday: number;
  pendingToday: number;
  topProducts: Array<{ name: string; qty: number }>;
  peakHours: Array<{ hour: string; ordersCount: number }>;
  topTables: Array<{ table: string; amount: number }>;
};

type MenuItemRow = {
  id: string;
  name: string;
  description: string;
  price_ars: number;
  is_active: boolean;
  category_code: string;
  image_url?: string | null;
};

type TableRow = {
  id: string;
  table_number: string;
  status: "libre" | "ocupada" | "esperando_pedido" | "comiendo" | "cobrando" | "cerrada";
  qr_token: string;
};

type HelpRow = {
  id: string;
  table_number: string | null;
  status: "nuevo" | "resuelto";
  created_at: string;
};

const viewLabel: Record<ViewKey, string> = {
  cocina: "Vista Cocina",
  caja: "Vista Caja",
  dueno: "Vista Dueño",
  menu: "Gestión de Menú",
  mesas: "Gestión de Mesas"
};

interface PanelScreenProps {
  restaurantSlug: string;
  basePath: string;
}

export function PanelScreen({ restaurantSlug, basePath }: PanelScreenProps) {
  const router = useRouter();
  const [view, setView] = useState<ViewKey>("cocina");
  const [staffName, setStaffName] = useState("Staff");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [helpRequests, setHelpRequests] = useState<HelpRow[]>([]);
  const [newTable, setNewTable] = useState("21");
  const [ticketOrder, setTicketOrder] = useState<OrderRow | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const restaurantParam = encodeURIComponent(restaurantSlug);
  const restaurantQuery = `?restaurant=${restaurantParam}`;
  const paths = staffPaths(restaurantSlug);
  const restaurantName = displayNameForRestaurantSlug(restaurantSlug);
  const ADMIN_VIEWS: ViewKey[] = ["dueno", "menu", "mesas"];
  const ADMIN_PASS = "123456789";

  const fetchOrders = useCallback(async () => {
    const response = await fetch(`/api/staff/orders${restaurantQuery}`, { cache: "no-store" });
    if (!response.ok) {
      const t = await response.text();
      console.error("[ORDEE-COCINA] fetchOrders FALLA HTTP", response.status, t.slice(0, 500));
      return;
    }
    const payload = (await response.json()) as { orders: OrderRow[]; restaurantId: string };
    const data = payload.orders ?? [];
    if (payload.restaurantId) setRestaurantId(payload.restaurantId);
    console.info("[ORDEE-COCINA] fetchOrders ok count=", data.length);
    const withNotes = data.filter((o) => o.notes);
    if (withNotes.length > 0) {
      console.info("[notes received kitchen]", withNotes.map((o) => ({ id: o.id, notes: o.notes })));
    }
    setOrders(data);
  }, [restaurantQuery]);

  const fetchMetrics = useCallback(async () => {
    const response = await fetch(`/api/staff/metrics${restaurantQuery}`, { cache: "no-store" });
    if (!response.ok) {
      const t = await response.text();
      console.error("[ORDEE-COCINA] fetchMetrics FALLA HTTP", response.status, t.slice(0, 500));
      return;
    }
    setMetrics((await response.json()) as Metrics);
  }, [restaurantQuery]);

  const fetchMenu = useCallback(async () => {
    const response = await fetch(`/api/staff/menu${restaurantQuery}`, { cache: "no-store" });
    if (!response.ok) return;
    setMenuItems((await response.json()) as MenuItemRow[]);
  }, [restaurantQuery]);

  const fetchTables = useCallback(async () => {
    const response = await fetch(`/api/staff/tables${restaurantQuery}`, { cache: "no-store" });
    if (!response.ok) return;
    setTables((await response.json()) as TableRow[]);
  }, [restaurantQuery]);

  const fetchHelp = useCallback(async () => {
    const response = await fetch(`/api/staff/help${restaurantQuery}`, { cache: "no-store" });
    if (!response.ok) {
      const t = await response.text();
      console.error("[ORDEE-COCINA] fetchHelp FALLA HTTP", response.status, t.slice(0, 500));
      return;
    }
    const data = (await response.json()) as HelpRow[];
    setHelpRequests(data);
    if (data.length > 0) {
      const audio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=");
      audio.play().catch(() => undefined);
    }
  }, [restaurantQuery]);

  useEffect(() => {
    const session = getStaffSessionForSlug(restaurantSlug);
    if (!session) {
      router.replace(paths.login);
      return;
    }
    setStaffName(session.name);

    if (localStorage.getItem("ordee_admin_auth") === "1") {
      console.info("[admin auth] session restored from localStorage");
      setAdminUnlocked(true);
    }

    fetchOrders();
    fetchMetrics();
    fetchMenu();
    fetchTables();
    fetchHelp();

    const interval = window.setInterval(() => {
      fetchOrders();
      fetchMetrics();
      fetchHelp();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [router, restaurantSlug, paths.login, fetchOrders, fetchMetrics, fetchMenu, fetchTables, fetchHelp]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !restaurantId) return;

    const channelName = `ordee-cocina-live-${restaurantId}`;
    const filter = `restaurant_id=eq.${restaurantId}`;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter }, (payload) => {
        console.info("[ORDEE-COCINA realtime] orders", payload.eventType, payload);
        fetchOrders();
        fetchMetrics();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, (payload) => {
        console.info("[ORDEE-COCINA realtime] order_items", payload.eventType);
        fetchOrders();
        fetchMetrics();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, (payload) => {
        console.info("[ORDEE-COCINA realtime] payments", payload.eventType);
        fetchOrders();
        fetchMetrics();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "help_requests", filter }, (payload) => {
        console.info("[ORDEE-COCINA realtime] help_requests", payload.eventType);
        fetchHelp();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter }, (payload) => {
        console.info("[ORDEE-COCINA realtime] menu_items", payload.eventType);
        fetchMenu();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables", filter }, (payload) => {
        console.info("[ORDEE-COCINA realtime] restaurant_tables", payload.eventType);
        fetchTables();
      })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") console.info("[ORDEE-COCINA realtime] canal SUBSCRIBED");
        if (status === "CHANNEL_ERROR") console.error("[ORDEE-COCINA realtime] CHANNEL_ERROR", err);
        if (status === "TIMED_OUT") console.warn("[ORDEE-COCINA realtime] TIMED_OUT");
      });

    console.info("[ORDEE-COCINA] Supabase URL (browser env)=", process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(vacío)");

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, fetchOrders, fetchMetrics, fetchHelp, fetchMenu, fetchTables]);

  const pendingOrders = useMemo(() => orders.filter((order) => order.payment_status !== "pagado"), [orders]);
  const paidOrders = useMemo(() => orders.filter((order) => order.payment_status === "pagado"), [orders]);

  const kitchenQueue = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status !== "entregado" &&
          order.status !== "cancelado" &&
          (order.payment_status === "pagado" || order.payment_method !== "mercado_pago")
      ),
    [orders]
  );

  const historialPedidos = useMemo(
    () =>
      [...orders]
        .filter((order) => order.status === "entregado")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders]
  );

  const deleteOrder = (id: string) => {
    void fetch(`/api/staff/orders/${id}${restaurantQuery}`, { method: "DELETE" }).then(() => {
      fetchOrders();
      fetchMetrics();
    });
  };

  const clearHistorialEntregados = () => {
    if (!window.confirm("¿Borrar todos los pedidos entregados del historial? No se puede deshacer.")) return;
    void fetch(`/api/staff/orders/cleanup${restaurantQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delivered" })
    }).then(async (res) => {
      if (!res.ok) {
        window.alert("No se pudo limpiar el historial");
        return;
      }
      fetchOrders();
      fetchMetrics();
    });
  };

  const updateOrder = async (id: string, patch: { status?: OrderRow["status"]; paymentStatus?: OrderRow["payment_status"]; cancelReason?: string }) => {
    await fetch(`/api/staff/orders/${id}${restaurantQuery}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    fetchOrders();
    fetchMetrics();
  };

  const logout = () => {
    clearStaffSession();
    router.replace(paths.login);
  };

  const adminLogin = () => {
    if (adminInput.trim() === ADMIN_PASS) {
      localStorage.setItem("ordee_admin_auth", "1");
      setAdminUnlocked(true);
      setAdminError("");
      setAdminInput("");
      console.info("[admin auth] access granted");
    } else {
      setAdminError("Contraseña incorrecta");
      console.info("[admin auth] failed attempt");
    }
  };

  const adminLogout = () => {
    localStorage.removeItem("ordee_admin_auth");
    setAdminUnlocked(false);
    setView("cocina");
    console.info("[admin auth] session closed");
  };

  const openTicket = (order: OrderRow) => {
    console.info("[ticket print]", { orderId: order.id, table: order.table_number, method: order.payment_method });
    setTicketOrder(order);
  };

  return (
    <main style={{ maxWidth: 1400 }}>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
        <aside className="card" style={{ height: "calc(100vh - 48px)", position: "sticky", top: 24 }}>
          <h3 style={{ marginTop: 0 }}>ORDEE-COCINA</h3>
          <p style={{ fontSize: 13, opacity: 0.8 }}>{restaurantName}</p>
          <p style={{ fontSize: 13, opacity: 0.8 }}>Bienvenido/a {staffName}</p>
          <div style={{ display: "grid", gap: 8 }}>
            {(Object.keys(viewLabel) as ViewKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key as ViewKey)}
                style={{ textAlign: "left", opacity: view === key ? 1 : 0.75 }}
              >
                {ADMIN_VIEWS.includes(key as ViewKey) && !adminUnlocked ? "🔒 " : null}
                {viewLabel[key as ViewKey]}
              </button>
            ))}
          </div>

          {adminUnlocked ? (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #3f3f46" }}>
              <p style={{ fontSize: 11, color: "#4ade80", margin: "0 0 6px", opacity: 0.9 }}>✓ Modo admin activo</p>
              <button type="button" onClick={adminLogout} style={{ width: "100%", fontSize: 12, textAlign: "left", opacity: 0.7 }}>
                Cerrar sesión admin
              </button>
            </div>
          ) : null}

          <button type="button" onClick={logout} style={{ marginTop: 12 }}>
            Salir
          </button>
        </aside>

        <section className="card" style={{ minHeight: 500 }}>
          <h2 style={{ marginTop: 0 }}>{viewLabel[view]}</h2>

          {helpRequests.length > 0 ? (
            <div style={{ border: "1px solid #b91c1c", background: "#450a0a", borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <strong>Alertas de soporte</strong>
              {helpRequests.map((help) => (
                <div key={help.id} style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span>Mesa {help.table_number ?? "sin dato"} necesita ayuda</span>
                  <button onClick={() => fetch(`/api/staff/help${restaurantQuery}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: help.id }) }).then(fetchHelp)}>
                    Resolver
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {view === "cocina" ? (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 8 }}>Pedidos en cocina</h3>
                <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>
                  Los pedidos MP aparecen cuando el pago está aprobado. Los pedidos en efectivo aparecen de inmediato.
                </p>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))" }}>
                  {kitchenQueue.map((order) => {
                    const minutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
                    const delayed = minutes >= 20 && order.status !== "entregado";
                    const isCash = order.payment_method !== "mercado_pago";
                    const isPaid = order.payment_status === "pagado";
                    return (
                      <article key={order.id} className="card" style={{ borderColor: delayed ? "#f59e0b" : isCash && !isPaid ? "#dc2626" : undefined }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <strong style={{ fontSize: 15 }}>{order.customer_name}</strong>
                          {isCash && !isPaid ? (
                            <span style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 6, letterSpacing: 0.5, whiteSpace: "nowrap" }}>
                              COBRAR EN EFECTIVO
                            </span>
                          ) : (
                            <span style={{ background: "#16a34a", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 6, letterSpacing: 0.5 }}>
                              PAGADO
                            </span>
                          )}
                        </div>
                        <p style={{ margin: "4px 0" }}>Mesa: {order.table_number ?? "—"}</p>
                        <p style={{ margin: "4px 0" }}>Hora: {new Date(order.created_at).toLocaleTimeString("es-AR")}</p>
                        <p style={{ margin: "4px 0" }}>Estado: {order.status}</p>
                        <p style={{ margin: "4px 0", fontSize: 12, opacity: 0.75 }}>Medio: {order.payment_method}</p>
                        {delayed ? <p style={{ color: "#fbbf24", margin: "4px 0" }}>Demorado ({minutes} min)</p> : null}
                        {order.notes ? (
                          <div style={{ margin: "8px 0", background: "#2d2d10", border: "1px solid #854d0e", borderRadius: 8, padding: "7px 10px" }}>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "#fbbf24", textTransform: "uppercase", marginBottom: 3 }}>
                              Observaciones
                            </p>
                            <p style={{ margin: 0, fontSize: 13, color: "#fef3c7", lineHeight: 1.5 }}>
                              {order.notes}
                            </p>
                          </div>
                        ) : null}
                        <ul>
                          {order.order_items.map((item, idx) => (
                            <li key={`${order.id}-${idx}`}>
                              {item.quantity} × {item.item_name}
                            </li>
                          ))}
                        </ul>
                        <p style={{ fontWeight: 600 }}>Total: ${order.total_ars}</p>
                        <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr" }}>
                          <button type="button" onClick={() => updateOrder(order.id, { status: "preparando" })}>
                            Preparar
                          </button>
                          <button type="button" onClick={() => updateOrder(order.id, { status: "entregado" })}>
                            Entregado
                          </button>
                        </div>
                        {isCash && !isPaid ? (
                          <button
                            type="button"
                            style={{ marginTop: 6, width: "100%", background: "#16a34a", borderColor: "#15803d", color: "#fff", fontWeight: 600 }}
                            onClick={() => {
                              console.info("[cash marked paid]", { orderId: order.id, table: order.table_number });
                              void updateOrder(order.id, { paymentStatus: "pagado" });
                            }}
                          >
                            ✓ Marcar como pagado
                          </button>
                        ) : null}
                        <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr", marginTop: 6 }}>
                          <button
                            type="button"
                            style={{ fontSize: 12 }}
                            onClick={() => openTicket(order)}
                          >
                            🖨 Imprimir ticket
                          </button>
                          <button
                            type="button"
                            style={{ fontSize: 12, background: "#3f1515", borderColor: "#7f1d1d" }}
                            onClick={() => {
                              if (!window.confirm("¿Estás seguro de eliminar el pedido?")) return;
                              deleteOrder(order.id);
                            }}
                          >
                            Eliminar pedido
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {kitchenQueue.length === 0 ? <p style={{ opacity: 0.8 }}>No hay pedidos activos.</p> : null}
              </div>

              <div>
                <h3 style={{ marginTop: 0, marginBottom: 8 }}>Historial (entregados)</h3>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={clearHistorialEntregados}>
                    Reiniciar historial (borrar entregados)
                  </button>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {historialPedidos.length === 0 ? <p style={{ opacity: 0.8 }}>Sin pedidos entregados.</p> : null}
                  {historialPedidos.map((order) => (
                    <div key={order.id} className="card" style={{ opacity: 0.9, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <span>
                        <strong>{order.customer_name}</strong> · Mesa {order.table_number ?? "—"} ·{" "}
                        {new Date(order.created_at).toLocaleString("es-AR")} · ${order.total_ars.toLocaleString("es-AR")}
                      </span>
                      <button type="button" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => openTicket(order)}>
                        🖨 Ticket
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {view === "caja" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <p>Pedidos cobrados hoy: {metrics?.paidToday ?? 0}</p>
              <p>Pedidos pendientes de cobro: {metrics?.pendingToday ?? 0}</p>
              <p>Total vendido del dia: ${metrics?.dailyRevenue ?? 0}</p>

              <h3>Pedidos pendientes</h3>
              {pendingOrders.map((order) => (
                <div key={order.id} className="card" style={{ marginBottom: 8 }}>
                  <strong>{order.customer_name}</strong> · Mesa {order.table_number ?? "-"} · ${order.total_ars}
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button onClick={() => updateOrder(order.id, { paymentStatus: "pagado" })}>Marcar pago manual</button>
                    <button onClick={() => openTicket(order)}>🖨 Imprimir ticket</button>
                    <button
                      onClick={() => {
                        if (!window.confirm("¿Estás seguro de eliminar el pedido?")) return;
                        deleteOrder(order.id);
                      }}
                    >
                      Eliminar pedido
                    </button>
                  </div>
                </div>
              ))}

              <h3>Pedidos cobrados</h3>
              {paidOrders.map((order) => (
                <div key={order.id} className="card" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span>
                    {order.customer_name} · Mesa {order.table_number ?? "—"} · ${order.total_ars.toLocaleString("es-AR")} · {order.payment_method === "mercado_pago" ? "Mercado Pago" : order.payment_method}
                  </span>
                  <button type="button" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => openTicket(order)}>
                    🖨 Ticket
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {ADMIN_VIEWS.includes(view) && !adminUnlocked ? (
            <div
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                minHeight: 320, gap: 0
              }}
            >
              <div
                style={{
                  background: "#1c1c1f", border: "1px solid #3f3f46", borderRadius: 14, padding: "32px 28px",
                  maxWidth: 360, width: "100%", display: "flex", flexDirection: "column", gap: 16, textAlign: "center"
                }}
              >
                <div style={{ fontSize: 36 }}>🔒</div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 17, margin: "0 0 4px" }}>Acceso restringido</p>
                  <p style={{ fontSize: 13, opacity: 0.65, margin: 0 }}>Esta sección requiere contraseña de administrador.</p>
                </div>
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={adminInput}
                  autoFocus
                  onChange={(e) => { setAdminInput(e.target.value); setAdminError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") adminLogin(); }}
                  style={{ textAlign: "center", fontSize: 16, letterSpacing: 4, padding: "10px 14px" }}
                />
                {adminError ? (
                  <p style={{ color: "#f87171", margin: 0, fontSize: 13 }}>{adminError}</p>
                ) : null}
                <button
                  type="button"
                  onClick={adminLogin}
                  style={{ background: "#f4f4f5", color: "#0a0a0a", border: "none", fontWeight: 700, padding: "11px 0", fontSize: 15, borderRadius: 8 }}
                >
                  Ingresar
                </button>
                <button
                  type="button"
                  onClick={() => { setView("cocina"); setAdminInput(""); setAdminError(""); }}
                  style={{ background: "none", border: "none", opacity: 0.5, fontSize: 13, padding: 0, cursor: "pointer", color: "inherit" }}
                >
                  Volver a cocina
                </button>
              </div>
            </div>
          ) : null}

          {view === "dueno" && adminUnlocked ? (
            <div style={{ display: "grid", gap: 10 }}>
              <p>Facturacion diaria: ${metrics?.dailyRevenue ?? 0}</p>
              <p>Facturacion semanal: ${metrics?.weeklyRevenue ?? 0}</p>
              <p>Facturacion mensual: ${metrics?.monthlyRevenue ?? 0}</p>
              <p>Cantidad de pedidos: {metrics?.ordersCount ?? 0}</p>
              <p>Ticket promedio: ${metrics?.avgTicket ?? 0}</p>
              <p>Medios de pago: {JSON.stringify(metrics?.paymentMethods ?? {})}</p>
              <div className="card">
                <strong>Productos mas vendidos</strong>
                {(metrics?.topProducts ?? []).map((row) => (
                  <p key={row.name} style={{ margin: "6px 0" }}>
                    {row.name}: {row.qty}
                  </p>
                ))}
              </div>
              <div className="card">
                <strong>Horas pico</strong>
                {(metrics?.peakHours ?? []).map((row) => (
                  <p key={row.hour} style={{ margin: "6px 0" }}>
                    {row.hour}: {row.ordersCount} pedidos
                  </p>
                ))}
              </div>
              <div className="card">
                <strong>Mesas con mayor consumo</strong>
                {(metrics?.topTables ?? []).map((row) => (
                  <p key={row.table} style={{ margin: "6px 0" }}>
                    Mesa {row.table}: ${row.amount}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {view === "menu" && adminUnlocked ? (
            <div>
              <button
                onClick={async () => {
                  const name = window.prompt("Nombre producto");
                  const price = Number(window.prompt("Precio ARS"));
                  const category = (window.prompt("Categoria: entrada/principal/bebida/postre") ?? "principal") as MenuItemRow["category_code"];
                  const imageUrl = window.prompt("URL de imagen gastronomica");
                  if (!name || Number.isNaN(price)) return;
                  await fetch(`/api/staff/menu${restaurantQuery}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "create", name, price_ars: price, category_code: category, image_url: imageUrl ?? undefined })
                  });
                  fetchMenu();
                }}
              >
                Agregar producto nuevo
              </button>
              <button
                onClick={async () => {
                  const code = (window.prompt("Codigo categoria (entrada/principal/bebida/postre)") ?? "") as MenuItemRow["category_code"];
                  const categoryName = window.prompt("Nombre categoria");
                  if (!code || !categoryName) return;
                  await fetch(`/api/staff/menu${restaurantQuery}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "create_category", category_code: code, category_name: categoryName })
                  });
                  fetchMenu();
                }}
                style={{ marginLeft: 8 }}
              >
                Crear categoria
              </button>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {menuItems.map((item) => (
                  <div key={item.id} className="card">
                    <strong>{item.name}</strong> · ${item.price_ars} · {item.category_code} · {item.is_active ? "Activo" : "Oculto"}
                    <p style={{ margin: "4px 0", fontSize: 12, opacity: 0.75 }}>{item.description || "Sin descripcion"}</p>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button
                        onClick={async () => {
                          const name = window.prompt("Nuevo nombre", item.name);
                          const description = window.prompt("Nueva descripcion", item.description ?? "");
                          const priceRaw = window.prompt("Precio ARS", String(item.price_ars));
                          if (!name) return;
                          const price = priceRaw != null && priceRaw !== "" ? Number(priceRaw) : item.price_ars;
                          if (Number.isNaN(price)) return;
                          await fetch(`/api/staff/menu${restaurantQuery}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "update", id: item.id, name, description: description ?? "", price_ars: price })
                          });
                          fetchMenu();
                        }}
                      >
                        Editar producto
                      </button>
                      <button
                        onClick={async () => {
                          await fetch(`/api/staff/menu${restaurantQuery}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "toggle", id: item.id, is_active: !item.is_active })
                          });
                          fetchMenu();
                        }}
                      >
                        {item.is_active ? "Marcar agotado" : "Volver disponible"}
                      </button>
                      <button
                        onClick={async () => {
                          await fetch(`/api/staff/menu${restaurantQuery}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "delete", id: item.id })
                          });
                          fetchMenu();
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {view === "mesas" && adminUnlocked ? (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input value={newTable} onChange={(event) => setNewTable(event.target.value)} />
                <button
                  onClick={async () => {
                    await fetch(`/api/staff/tables${restaurantQuery}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "create", table_number: newTable })
                    });
                    fetchTables();
                  }}
                >
                  Crear mesa
                </button>
              </div>
              {tables.map((table) => (
                <div key={table.id} className="card" style={{ marginBottom: 8 }}>
                  Mesa {table.table_number} · Estado: {table.status} · QR: {table.qr_token}
                  <p style={{ margin: "4px 0", fontSize: 12, opacity: 0.8 }}>
                    URL QR: {`/r/${restaurantSlug}/menu`} (mesa {table.table_number})
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    {["libre", "ocupada", "esperando_pedido", "comiendo", "cobrando", "cerrada"].map((status) => (
                      <button
                        key={status}
                        onClick={async () => {
                          await fetch(`/api/staff/tables${restaurantQuery}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "update", id: table.id, status })
                          });
                          fetchTables();
                        }}
                      >
                        {status}
                      </button>
                    ))}
                    <button
                      onClick={async () => {
                        await fetch(`/api/staff/tables${restaurantQuery}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "delete", id: table.id })
                        });
                        fetchTables();
                      }}
                    >
                      Eliminar mesa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {ticketOrder ? (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.75)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setTicketOrder(null); }}
        >
          <div style={{ background: "#fff", color: "#111", borderRadius: 12, maxWidth: 400, width: "100%", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 15 }}>Vista previa del ticket</strong>
              <button
                onClick={() => setTicketOrder(null)}
                style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 0 }}
              >
                ✕
              </button>
            </div>
            <div id="ticket-print-area" style={{ padding: "20px 18px", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 2 }}>ORDEE</div>
                <div style={{ fontSize: 11, color: "#555" }}>Restaurante</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                  {new Date(ticketOrder.created_at).toLocaleString("es-AR")}
                </div>
              </div>
              <div style={{ borderTop: "1px dashed #aaa", borderBottom: "1px dashed #aaa", padding: "8px 0", margin: "8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Mesa:</span><strong>{ticketOrder.table_number ?? "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Cliente:</span><strong>{ticketOrder.customer_name}</strong>
                </div>
              </div>
              {ticketOrder.notes ? (
                <div style={{ margin: "6px 0", padding: "6px 8px", background: "#fefce8", border: "1px solid #fde68a", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Observaciones</div>
                  <div style={{ fontSize: 12, color: "#451a03" }}>{ticketOrder.notes}</div>
                </div>
              ) : null}
              <div style={{ margin: "8px 0" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 8px", fontSize: 13 }}>
                  {ticketOrder.order_items.map((item, idx) => {
                    const subtotal = item.quantity * (item.unit_price_ars ?? 0);
                    console.info("[ticket item totals rendered]", { item: item.item_name, qty: item.quantity, unit: item.unit_price_ars, subtotal });
                    return (
                      <>
                        <span key={`name-${idx}`} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.quantity} × {item.item_name}
                        </span>
                        <span key={`price-${idx}`} style={{ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                          {item.unit_price_ars ? `$${subtotal.toLocaleString("es-AR")}` : ""}
                        </span>
                      </>
                    );
                  })}
                </div>
              </div>
              <div style={{ borderTop: "1px dashed #aaa", marginTop: 8, paddingTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
                  <span>TOTAL</span>
                  <span>${ticketOrder.total_ars.toLocaleString("es-AR")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
                  <span>Medio de pago:</span>
                  <span style={{ fontWeight: 600 }}>
                    {ticketOrder.payment_method === "mercado_pago"
                      ? "Mercado Pago"
                      : ticketOrder.payment_method === "efectivo"
                        ? "Efectivo"
                        : ticketOrder.payment_method}
                  </span>
                </div>
                <div style={{ marginTop: 8, textAlign: "center" }}>
                  {ticketOrder.payment_method !== "mercado_pago" && ticketOrder.payment_status !== "pagado" ? (
                    <span style={{ display: "inline-block", background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, letterSpacing: 0.5 }}>
                      COBRAR EN EFECTIVO
                    </span>
                  ) : (
                    <span style={{ display: "inline-block", background: "#16a34a", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, letterSpacing: 0.5 }}>
                      PAGADO
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#888" }}>
                ¡Gracias por su visita!
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8 }}>
              <button
                onClick={() => setTicketOrder(null)}
                style={{ flex: 1, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#374151", borderRadius: 8, padding: "9px 12px", cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  console.info("[ticket print]", { orderId: ticketOrder.id, table: ticketOrder.table_number });
                  window.print();
                }}
                style={{ flex: 1, background: "#111", border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}
              >
                🖨 Imprimir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
