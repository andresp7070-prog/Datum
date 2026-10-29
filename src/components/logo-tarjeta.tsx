// Logo propio solo para Visa y Mastercard (no los oficiales pixel por
// pixel, pero con los colores y formas reconocibles de cada una — mismo
// criterio que usa cualquier pasarela de pago). Para todo lo demás (Amex,
// Diners, Bancolombia, cualquier marca sin reconocer) se usa el mismo
// ícono genérico de tarjeta — decisión explícita de Andrés (2026-10-29):
// con solo dos marcas tan universalmente reconocibles vale la pena un
// logo propio; para el resto, el nombre en texto (ver
// lista-metodos-pago.tsx y cuenta/page.tsx) identifica mejor que un ícono
// inventado.
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
    default:
      return (
        <svg viewBox="0 0 36 24" className={clase} role="img" aria-label="Tarjeta">
          <rect x="0.5" y="0.5" width="35" height="23" rx="4" fill="#ffffff" stroke="#D1D5DB" />
          <rect x="0.5" y="6" width="35" height="4" fill="#9CA3AF" />
        </svg>
      );
  }
}
