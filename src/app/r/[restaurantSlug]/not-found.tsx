import Link from "next/link";

export default function RestaurantNotFound() {
  return (
    <main className="card" style={{ maxWidth: 480, margin: "48px auto" }}>
      <h1 style={{ marginTop: 0 }}>Restaurante no encontrado</h1>
      <p style={{ opacity: 0.85 }}>El slug de esta URL no corresponde a un restaurante registrado en ORDEE.</p>
      <p>
        <Link href="/">Volver al login demo</Link>
      </p>
    </main>
  );
}
