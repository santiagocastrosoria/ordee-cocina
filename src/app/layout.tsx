import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ORDEE Cocina",
  description: "Portal separado de cocina",
  icons: {
    icon: [
      { url: "/favicon.ico?v=4", sizes: "any" },
      { url: "/icon.png?v=4", type: "image/png", sizes: "32x32" },
      { url: "/icon.png?v=4", type: "image/png", sizes: "192x192" }
    ],
    shortcut: "/favicon.ico?v=4",
    apple: "/apple-touch-icon.png?v=4"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
