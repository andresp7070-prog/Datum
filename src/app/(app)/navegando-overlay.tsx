"use client";

import { useNavegacion } from "./navegacion";

// Se superpone sobre el contenido actual (no lo reemplaza) mientras navega
// de un módulo a otro — por eso el fondo es traslúcido y con blur: la
// pantalla anterior se sigue viendo debajo, atenuada, en vez de un blanco
// sólido que la hace desaparecer de golpe.
export function NavegandoOverlay() {
  const { navegando } = useNavegacion();

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/70 backdrop-blur-sm transition-opacity duration-200 ${
        navegando ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!navegando}
    >
      <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12 text-accent" aria-hidden="true">
        <path
          d="M 24 42 A 18 18 0 1 1 36.321 37.122"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          className="aguja-girando"
          d="M24 10 L29 24 L24 38 L19 24 Z"
          fill="currentColor"
        />
      </svg>
      <span className="font-serif text-3xl font-semibold text-gray-900">Datum</span>
      <span className="text-sm text-gray-500">Cargando…</span>
    </div>
  );
}
