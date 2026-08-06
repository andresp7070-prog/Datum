// Respaldo para navegaciones que tardan más de ~medio segundo: para esas,
// NavegandoOverlay (navegando.tsx) ya no alcanza a mantener oculto el
// cambio de ruta y Next reemplaza el contenido con este archivo (convención
// de loading.tsx). Usa el mismo fondo traslúcido con blur que el overlay,
// en vez de blanco sólido, para que se sienta continuo en vez de un salto.
export default function Cargando() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/70 backdrop-blur-sm text-accent">
      <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12" aria-hidden="true">
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
