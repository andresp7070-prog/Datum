"use client";

import { useState } from "react";
import { anularFacturaConNotaCredito } from "./actions";

type Estado = "reposo" | "confirmar" | "cargando" | "error" | "listo";

export function BotonAnularNotaCredito({ ventaId }: { ventaId: string }) {
  const [estado, setEstado] = useState<Estado>("reposo");
  const [error, setError] = useState<string | null>(null);
  const [linkPublico, setLinkPublico] = useState<string | null>(null);

  async function confirmar() {
    setEstado("cargando");
    setError(null);
    const res = await anularFacturaConNotaCredito(ventaId);
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
        <p className="text-gray-400">Factura anulada</p>
        {linkPublico && (
          <a
            href={linkPublico}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 underline hover:text-gray-600"
          >
            Ver nota crédito
          </a>
        )}
      </div>
    );
  }

  if (estado === "confirmar" || estado === "cargando") {
    return (
      <div className="mt-1 text-right text-xs">
        <p className="text-gray-500">¿Anular esta factura con una nota crédito?</p>
        <div className="mt-0.5 flex justify-end gap-2">
          <button
            type="button"
            onClick={confirmar}
            disabled={estado === "cargando"}
            className="font-medium text-red-600 underline disabled:opacity-50"
          >
            {estado === "cargando" ? "Anulando..." : "Sí, anular"}
          </button>
          <button type="button" onClick={() => setEstado("reposo")} className="text-gray-400 underline">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 text-right">
      <button
        type="button"
        onClick={() => setEstado("confirmar")}
        className="text-xs text-gray-400 underline hover:text-gray-600"
      >
        Anular con nota crédito
      </button>
      {estado === "error" && error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
