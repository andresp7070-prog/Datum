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
  valorVentaActual,
}: {
  leadId: string;
  etapas: Etapa[];
  etapaActualId: string | null;
  valorVentaActual: number | null;
}) {
  const router = useRouter();
  const [etapa, setEtapa] = useState(etapaActualId ?? "");
  const [valorVenta, setValorVenta] = useState(valorVentaActual);
  const [guardando, setGuardando] = useState(false);
  const [etapaPendiente, setEtapaPendiente] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nombreEtapa = (id: string) => etapas.find((item) => item.id === id)?.nombre ?? null;

  async function aplicarCambio(valor: string, valorVentaNuevo?: number) {
    const etapaAnterior = etapa;
    const valorVentaAnterior = valorVenta;
    setEtapa(valor);
    if (valorVentaNuevo !== undefined) setValorVenta(valorVentaNuevo);
    setGuardando(true);
    const resultado = await cambiarEtapaLead({
      leadId,
      etapaId: valor,
      etapaNombreAnterior: nombreEtapa(etapaAnterior),
      etapaNombreNueva: nombreEtapa(valor),
      huboCambioEtapa: etapaAnterior !== valor,
      valorVenta: valorVentaNuevo,
      valorVentaAnterior,
    });
    setError(resultado.error);
    if (resultado.error) {
      setEtapa(etapaAnterior);
      if (valorVentaNuevo !== undefined) setValorVenta(valorVentaAnterior);
    }
    setGuardando(false);
    router.refresh();
  }

  function onChange(valor: string) {
    const destino = etapas.find((item) => item.id === valor);
    if (destino?.es_cierre && valorVenta == null) {
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
          onConfirm={(valorVentaNuevo) => {
            const destino = etapaPendiente;
            setEtapaPendiente(null);
            aplicarCambio(destino, valorVentaNuevo);
          }}
          onCancel={() => setEtapaPendiente(null)}
        />
      )}
    </>
  );
}
