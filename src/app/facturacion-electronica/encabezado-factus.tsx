// Mismo ícono de compás que src/app/(app)/sidebar.tsx — se duplica acá a
// propósito (componente chico, un solo archivo lo usa de verdad), para que
// esta pantalla se vea parte de la misma identidad visual de Datum en vez
// de la caja gris/genérica que tenía antes.
function LogoCompass({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={`${className} shrink-0`} aria-hidden="true">
      <path
        d="M 24 42 A 18 18 0 1 1 36.321 37.122"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M24 10 L29 24 L24 38 L19 24 Z" fill="currentColor" />
    </svg>
  );
}

const TINTE: Record<"neutral" | "exito" | "alerta", string> = {
  neutral: "bg-accent/10 text-accent",
  exito: "bg-amber-600/10 text-amber-600",
  alerta: "bg-red-50 text-red-600",
};

// Centra el contenido de la pantalla (horizontal y vertical) dentro del
// área principal — antes quedaba pegado arriba a la izquierda, como
// cualquier otra pantalla de la plataforma, pero esta se siente más como
// un mensaje/estado puntual que como una tabla o formulario largo.
export function CentroFactus({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}

export function EncabezadoFactus({
  tinte = "neutral",
}: {
  tinte?: "neutral" | "exito" | "alerta";
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TINTE[tinte]}`}>
        <LogoCompass />
      </div>
      <h1 className="font-serif text-2xl font-semibold text-gray-900">Facturación electrónica</h1>
    </div>
  );
}
