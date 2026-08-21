"use client";

import { useEffect, useRef, useState } from "react";

type Responsable = { id: string; nombre: string };

// Desplegable buscable para asignar el responsable de un contacto/lead.
// Si el nombre que se escribe no existe en la lista, aparece la opción de
// crearlo ahí mismo — es solo un nombre (sin cuenta ni acceso a Datum),
// así que crear uno nuevo no pasa por ningún flujo de invitación.
export function ResponsableSelector({
  responsables,
  nombreActual,
  guardando,
  onSeleccionar,
  onCrear,
}: {
  responsables: Responsable[];
  nombreActual: string | null;
  guardando?: boolean;
  onSeleccionar: (id: string | null) => void;
  onCrear: (nombre: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const contenedorRef = useRef<HTMLDivElement>(null);

  const q = texto.trim().toLowerCase();
  const filtrados = q ? responsables.filter((r) => r.nombre.toLowerCase().includes(q)) : responsables;
  const existeExacto = responsables.some((r) => r.nombre.toLowerCase() === q);

  useEffect(() => {
    if (!abierto) return;
    function alHacerClicAfuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
        setTexto("");
      }
    }
    document.addEventListener("mousedown", alHacerClicAfuera);
    return () => document.removeEventListener("mousedown", alHacerClicAfuera);
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    setTexto("");
  }

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={guardando}
        className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {nombreActual ?? "Sin asignar"}
      </button>

      {abierto && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar o escribir un nombre"
            className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
          />
          <ul className="max-h-40 overflow-y-auto">
            {nombreActual && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onSeleccionar(null);
                    cerrar();
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50"
                >
                  Quitar responsable
                </button>
              </li>
            )}
            {filtrados.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSeleccionar(r.id);
                    cerrar();
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-50"
                >
                  {r.nombre}
                </button>
              </li>
            ))}
            {filtrados.length === 0 && !q && (
              <li className="px-2 py-1.5 text-xs text-gray-400">Todavía no hay responsables.</li>
            )}
          </ul>
          {q && !existeExacto && (
            <button
              type="button"
              onClick={() => {
                onCrear(texto.trim());
                cerrar();
              }}
              className="mt-1 block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-accent hover:bg-accent/5"
            >
              + Crear &ldquo;{texto.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
