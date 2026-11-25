import type { Metadata } from "next";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
import "@/styles/components.css";
import "@/styles/components-extra.css";
import "./globals.css";
import iconoPng from "@/assets/icono.png";

export const metadata: Metadata = {
  title: "Matriz Automatizada · Instacredit",
  description: "Evalúa solicitudes de crédito y muestra el resultado.",
  icons: {
    icon: [{ url: iconoPng.src, type: "image/png" }],
    apple: iconoPng.src,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
