// Logos simplificados (no los oficiales pixel por pixel, pero con los
// colores y formas reconocibles de cada marca — mismo criterio que usa
// cualquier pasarela de pago para mostrar qué tarjeta tiene guardada un
// cliente). marca viene de marcaDesdeBin() en src/lib/wompi.ts; null cae
// en el ícono genérico de tarjeta.
export function LogoTarjeta({ marca, className }: { marca: string | null; className?: string }) {
  const clase = className ?? "h-6 w-9 shrink-0";

  switch (marca) {
    case "Visa":
      return (
        <svg viewBox="0 0 36 24" className={clase} role="img" aria-label="Visa">
          <rect width="36" height="24" rx="4" fill="#1A1F71" />
          <text
            x="18"
            y="16"
            textAnchor="middle"
            fontSize="10"
            fontStyle="italic"
            fontWeight="700"
            fill="#ffffff"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            VISA
          </text>
        </svg>
      );
    case "Mastercard":
      return (
        <svg viewBox="0 0 36 24" className={clase} role="img" aria-label="Mastercard">
          <rect width="36" height="24" rx="4" fill="#F4F4F5" />
          <circle cx="15" cy="12" r="7" fill="#EB001B" />
          <circle cx="21" cy="12" r="7" fill="#F79E1B" fillOpacity="0.85" />
        </svg>
      );
    case "American Express":
      return (
        <svg viewBox="0 0 36 24" className={clase} role="img" aria-label="American Express">
          <rect width="36" height="24" rx="4" fill="#006FCF" />
          <text
            x="18"
            y="15"
            textAnchor="middle"
            fontSize="6.5"
            fontWeight="700"
            fill="#ffffff"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            AMEX
          </text>
        </svg>
      );
    case "Bancolombia":
      // Sin logo oficial de Bancolombia/Wompi confirmado para usar acá —
      // se buscó, no hay ningún activo público verificado (solo un manual
      // de marca del propio Wompi, marcado confidencial, y de Wompi, no
      // de Bancolombia). Dos intentos propios (círculo, tres trazos) no
      // convencieron a Andrés — se deja sin ícono a propósito; el nombre
      // se agrega como texto en su lugar (ver lista-metodos-pago.tsx y
      // cuenta/page.tsx).
      return null;
    case "Diners Club":
      return (
        <svg viewBox="0 0 36 24" className={clase} role="img" aria-label="Diners Club">
          <rect width="36" height="24" rx="4" fill="#0079BE" />
          <circle cx="18" cy="12" r="7" fill="#ffffff" />
          <rect x="17" y="5" width="2" height="14" fill="#0079BE" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 36 24" className={clase} role="img" aria-label="Tarjeta">
          <rect x="0.5" y="0.5" width="35" height="23" rx="4" fill="#ffffff" stroke="#D1D5DB" />
          <rect x="0.5" y="6" width="35" height="4" fill="#9CA3AF" />
        </svg>
      );
  }
}
