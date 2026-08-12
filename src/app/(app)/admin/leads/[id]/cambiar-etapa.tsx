"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cambiarEtapaLead } from "./actions";
import { ValorVentaModal } from "../valor-venta-modal";

type Etapa = { id: string; nombre: string; orden: number; es_cierre: boolean };

export function CambiarEtapa({
  leadId,
  etapas,
  etapaActualId,
  tieneValorVenta,
}: {
  leadId: string;
  etapas: Etapa[];
  etapaActualId: string | null;
  tieneValorVenta: boolean;
}) {
  const router = useRouter();
  const [etapa, setEtapa] = useState(etapaActualId ?? "");
  const [guardando, setGuardando] = useState(false);
  const [etapaPendiente, setEtapaPendiente] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function aplicarCambio(valor: string, valorVenta?: number) {
    setEtapa(valor);
    setGuardando(true);
    const resultado = await cambiarEtapaLead(leadId, valor, valorVenta);
    setError(resultado.error);
    setGuardando(false);
    router.refresh();
  }

  function onChange(valor: string) {
    const destino = etapas.find((item) => item.id === valor);
    if (destino?.es_cierre && !tieneValorVenta) {
      setEtapaPendiente(valor);
      return;
    }
    aplicarCambio(valor);
  }

  return (
    <>
      <select
        value={etapa}
        onChange={(e) => onChange(e.target.value)}
        disabled={guardando}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
      >
        {etapas.map((item) => (
          <option key={item.id} value={item.id}>
            {item.nombre}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {etapaPendiente && (
        <ValorVentaModal
          onConfirm={(valorVenta) => {
            const destino = etapaPendiente;
            setEtapaPendiente(null);
            aplicarCambio(destino, valorVenta);
          }}
          onCancel={() => setEtapaPendiente(null)}
        />
      )}
    </>
  );
}
