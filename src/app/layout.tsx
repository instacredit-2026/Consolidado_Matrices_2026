import type { Metadata } from "next";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
import "@/styles/components.css";
import "@/styles/components-extra.css";
import "./globals.css";
import iconoSvg from "@/assets/icono.svg";
import iconoPng from "@/assets/icono.png";

export const metadata: Metadata = {
  title: "Matriz Automatizada · Instacredit",
  description: "Evalúa solicitudes de crédito y genera un informe PDF.",
  icons: {
    icon: [{ url: iconoSvg.src, type: "image/svg+xml" }, { url: iconoPng.src, type: "image/png" }],
    apple: iconoPng.src,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
