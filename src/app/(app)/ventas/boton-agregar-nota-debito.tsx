"use client";

import { useState } from "react";
import { agregarNotaDebito } from "./actions";

const CONCEPTOS = [
  { code: "1", label: "Intereses" },
  { code: "2", label: "Gastos por cobrar" },
  { code: "3", label: "Cambio del valor" },
  { code: "4", label: "Otros" },
];

type Estado = "reposo" | "formulario" | "cargando" | "error" | "listo";

export function BotonAgregarNotaDebito({ ventaId }: { ventaId: string }) {
  const [estado, setEstado] = useState<Estado>("reposo");
  const [conceptoCode, setConceptoCode] = useState("4");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkPublico, setLinkPublico] = useState<string | null>(null);

  async function confirmar() {
    const montoNumero = Number(monto);
    if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
      setError("Escribe un monto válido.");
      setEstado("error");
      return;
    }
    setEstado("cargando");
    setError(null);
    const res = await agregarNotaDebito(ventaId, { conceptoCode, descripcion, monto: montoNumero });
    if (!res.ok) {
      setError(res.error);
      setEstado("error");
      return;
    }
    setLinkPublico(res.linkPublico);
    setEstado("listo");
  }

  if (estado === "listo") {
    return (
      <div className="mt-1 text-right text-xs">
        <p className="text-gray-400">Nota débito agregada</p>
        {linkPublico && (
          <a
            href={linkPublico}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 underline hover:text-gray-600"
          >
            Ver nota débito
          </a>
        )}
      </div>
    );
  }

  if (estado === "formulario" || estado === "cargando" || estado === "error") {
    return (
      <div className="mt-1 w-56 text-right text-xs">
        <div className="flex flex-wrap justify-end gap-1">
          {CONCEPTOS.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setConceptoCode(c.code)}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                conceptoCode === c.code
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-500 hover:border-gray-400"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción (opcional)"
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none"
        />
        <input
          type="number"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="Monto a cobrar"
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none"
        />
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={confirmar}
            disabled={estado === "cargando"}
            className="font-medium text-gray-700 underline disabled:opacity-50"
          >
            {estado === "cargando" ? "Agregando..." : "Confirmar"}
          </button>
          <button type="button" onClick={() => setEstado("reposo")} className="text-gray-400 underline">
            Cancelar
          </button>
        </div>
        {estado === "error" && error && <p className="mt-1 text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEstado("formulario")}
      className="mt-1 text-xs text-gray-400 underline hover:text-gray-600"
    >
      Agregar nota débito
    </button>
  );
}
