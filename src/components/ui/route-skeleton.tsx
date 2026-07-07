import type { CSSProperties } from "react";

export function PanelRouteSkeleton() {
  const block: CSSProperties = {
    background: "#e4e4e7",
    borderRadius: 12,
    animation: "ordee-pulse 1.5s ease-in-out infinite"
  };

  return (
    <div
      style={{ display: "flex", minHeight: "100vh", gap: 16, padding: 16 }}
      aria-busy="true"
      aria-label="Cargando panel"
    >
      <style>{`@keyframes ordee-pulse { 0%,100%{opacity:1} 50%{opacity:.55} }`}</style>
      <div style={{ ...block, display: "none", width: 208, flexShrink: 0 }} className="panel-skeleton-sidebar" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...block, height: 40, width: 192 }} />
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ ...block, height: 128 }} />
          ))}
        </div>
      </div>
      <style>{`@media (min-width: 768px) { .panel-skeleton-sidebar { display: block !important; } }`}</style>
    </div>
  );
}
