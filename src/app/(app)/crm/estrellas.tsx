"use client";

// Calificación de 0 a 5 estrellas. Sin onChange es solo de lectura (ej. en
// el directorio); con onChange se puede hacer clic para calificar — clic en
// la estrella ya seleccionada la quita, para poder dejar la calificación en
// blanco de nuevo.
export function Estrellas({
  valor,
  onChange,
  tamano = "sm",
}: {
  valor: number | null;
  onChange?: (valor: number | null) => void;
  tamano?: "sm" | "md";
}) {
  const interactivo = Boolean(onChange);
  const tamanoClase = tamano === "md" ? "text-lg" : "text-sm";

  return (
    <div className="flex items-center gap-0.5" aria-label={`Calificación: ${valor ?? 0} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const llena = (valor ?? 0) >= n;
        if (!interactivo) {
          return (
            <span key={n} className={`${tamanoClase} ${llena ? "text-amber-400" : "text-gray-200"}`}>
              ★
            </span>
          );
        }
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(valor === n ? null : n)}
            className={`${tamanoClase} ${llena ? "text-amber-400" : "text-gray-200"} hover:text-amber-400`}
            aria-label={`Calificar con ${n} estrella${n === 1 ? "" : "s"}`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
