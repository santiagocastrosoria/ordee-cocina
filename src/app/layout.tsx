import "./globals.css";

export const metadata = {
  title: "ORDEE Cocina",
  description: "Portal separado de cocina"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
