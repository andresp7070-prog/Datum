"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const OPCIONES: { valor: string; etiqueta: string }[] = [
  { valor: "todo", etiqueta: "Todo el tiempo" },
  { valor: "7d", etiqueta: "Últimos 7 días" },
  { valor: "15d", etiqueta: "Últimos 15 días" },
  { valor: "30d", etiqueta: "Últimos 30 días" },
  { valor: "este_mes", etiqueta: "Este mes" },
  { valor: "mes_anterior", etiqueta: "Mes anterior" },
  { valor: "este_anio", etiqueta: "Este año" },
];

export function FiltroFecha({ periodoActual }: { periodoActual: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mostrarPersonalizado, setMostrarPersonalizado] = useState(periodoActual === "personalizado");
  const [desde, setDesde] = useState(searchParams.get("desde") ?? "");
  const [hasta, setHasta] = useState(searchParams.get("hasta") ?? "");

  function irA(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
  }

  function elegirPreset(valor: string) {
    setMostrarPersonalizado(false);
    const params = new URLSearchParams();
    params.set("periodo", valor);
    irA(params);
  }

  function aplicarPersonalizado() {
    if (!desde || !hasta) return;
    const params = new URLSearchParams();
    params.set("periodo", "personalizado");
    params.set("desde", desde);
    params.set("hasta", hasta);
    irA(params);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {OPCIONES.map((op) => (
          <button
            key={op.valor}
            type="button"
            onClick={() => elegirPreset(op.valor)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              periodoActual === op.valor
                ? "border-accent bg-accent text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {op.etiqueta}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMostrarPersonalizado((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            periodoActual === "personalizado"
              ? "border-accent bg-accent text-white"
              : "border-gray-300 text-gray-700 hover:bg-gray-100"
          }`}
        >
          Personalizado
        </button>
      </div>

      {mostrarPersonalizado && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={aplicarPersonalizado}
            disabled={!desde || !hasta}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
