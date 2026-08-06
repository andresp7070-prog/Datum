import type { Metadata } from "next";
import { Hanken_Grotesk, Geist_Mono, Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Misma serif del wordmark "Datum" de la landing (src/app/landing.css) —
// se carga acá también para que el logo se vea igual dentro de la app,
// ej. en el menú lateral (src/app/(app)/sidebar.tsx) y en la pantalla de
// carga entre módulos.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

// La sans-serif de todo el cuerpo de texto de la landing (src/app/landing.css)
// — antes venía embebida como base64 directo en ese archivo (~100KB extra en
// cada carga), un resabio de cuando ese diseño se probó primero como un HTML
// independiente. Cargarla acá la deja optimizada (solo los cortes que hacen
// falta) y sin duplicar peso.
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plataforma de gestión",
  description: "Diagnóstico y plataforma de gestión para pymes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${hankenGrotesk.variable} ${geistMono.variable} ${fraunces.variable} ${publicSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
