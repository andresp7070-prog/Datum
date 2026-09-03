"use client";

import { useEffect, useRef, useState } from "react";

type Opcion = { value: string; label: string };

// Selector múltiple genérico en un desplegable con casillas — lo usan
// tanto "Productos de interés" (catálogo real de inventario_items) como
// "Módulos de interés" (lista fija de módulos, para Datum) en la ficha
// de un contacto/lead.
export function MultiSelector({
  opciones,
  seleccionados,
  onChange,
  deshabilitado,
  placeholder = "Sin elegir",
}: {
  opciones: Opcion[];
  seleccionados: string[];
  onChange: (valores: string[]) => void;
  deshabilitado?: boolean;
  placeholder?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alHacerClicAfuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicAfuera);
    return () => document.removeEventListener("mousedown", alHacerClicAfuera);
  }, [abierto]);

  // Si un valor guardado no está entre las opciones (ej. un lead que
  // llegó del formulario público de la landing, donde los módulos son
  // texto plano en vez de ids del catálogo real de Datum), se muestra tal
  // cual en vez de desaparecer en silencio — mejor un texto sin traducir
  // que un "Sin elegir" engañoso cuando sí hay algo guardado.
  const etiquetas = seleccionados.map(
    (valor) => opciones.find((o) => o.value === valor)?.label ?? valor,
  );

  function alternar(value: string) {
    if (seleccionados.includes(value)) {
      onChange(seleccionados.filter((v) => v !== value));
    } else {
      onChange([...seleccionados, value]);
    }
  }

  return (
    <div className="relative" ref={contenedorRef}>
      {/* whitespace-normal (no truncate) a propósito — con varios valores
          elegidos, el texto combinado (ej. "Ventas, Estado de resultados,
          Facturación electrónica") fácilmente pasaba el ancho fijo y el
          corte con "…" se comía el final de la lista en silencio, aunque
          el dato sí estuviera guardado. Ahora el botón crece hacia abajo
          en vez de recortar. */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={deshabilitado}
        className="max-w-[220px] whitespace-normal break-words rounded-lg border border-gray-300 px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {etiquetas.length > 0 ? etiquetas.join(", ") : placeholder}
      </button>

      {abierto && (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          {opciones.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-gray-400">No hay opciones todavía.</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto">
              {opciones.map((opcion) => (
                <li key={opcion.value}>
                  <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-900 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={seleccionados.includes(opcion.value)}
                      onChange={() => alternar(opcion.value)}
                    />
                    {opcion.label}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
