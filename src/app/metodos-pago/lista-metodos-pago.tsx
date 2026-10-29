"use client";

import { useState, useTransition } from "react";
import { marcarPredeterminado, borrarMetodo } from "./actions";
import { LogoTarjeta } from "@/components/logo-tarjeta";

type Metodo = {
  id: string;
  metodo_marca: string | null;
  metodo_ultimos_digitos: string | null;
  es_predeterminado: boolean;
  creado_en: string;
};

function etiquetaTarjeta(m: Metodo): string {
  if (m.metodo_ultimos_digitos) return `•••• ${m.metodo_ultimos_digitos}`;
  return `Tarjeta guardada el ${new Date(m.creado_en).toLocaleDateString("es-CO")}`;
}

export function ListaMetodosPago({ metodos }: { metodos: Metodo[] }) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-4 space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {metodos.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <LogoTarjeta marca={m.metodo_marca} />
            <div>
              <p className="text-sm font-medium text-gray-900">{etiquetaTarjeta(m)}</p>
              {m.es_predeterminado && (
                <span className="mt-1 inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  Se usa para cobrar
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            {!m.es_predeterminado && (
              <button
                type="button"
                disabled={pendiente}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const res = await marcarPredeterminado(m.id);
                    if (!res.ok) setError(res.error);
                  })
                }
                className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
              >
                Usar esta
              </button>
            )}
            <button
              type="button"
              disabled={pendiente}
              onClick={() => {
                if (!confirm("¿Quitar este método de pago?")) return;
                startTransition(async () => {
                  setError(null);
                  const res = await borrarMetodo(m.id);
                  if (!res.ok) setError(res.error);
                });
              }}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              Quitar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
