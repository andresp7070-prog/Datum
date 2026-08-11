"use client";

import { useState } from "react";

export function ValorVentaModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (valor: number) => void;
  onCancel: () => void;
}) {
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string | null>(null);

  function confirmar() {
    const numero = Number(valor);
    if (!valor.trim() || Number.isNaN(numero) || numero <= 0) {
      setError("Escribe el valor de la venta, mayor a cero.");
      return;
    }
    onConfirm(numero);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">¿Cuánto se vendió?</h2>
        <p className="mb-3 text-xs text-gray-500">
          Este lead pasa a la etapa de cierre — anota el valor de la venta que generó. La
          calificación en estrellas se calcula sola a partir de este valor.
        </p>
        <input
          type="number"
          min={1}
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Valor de la venta"
          className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
