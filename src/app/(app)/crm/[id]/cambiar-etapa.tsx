"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cambiarEtapa } from "./actions";

type Etapa = { id: string; nombre: string; orden: number };

export function CambiarEtapa({
  contactoId,
  etapas,
  etapaActualId,
}: {
  contactoId: string;
  etapas: Etapa[];
  etapaActualId: string | null;
}) {
  const router = useRouter();
  const [etapa, setEtapa] = useState(etapaActualId ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(valor: string) {
    setEtapa(valor);
    setGuardando(true);
    const resultado = await cambiarEtapa(contactoId, valor);
    setError(resultado.error);
    setGuardando(false);
    router.refresh();
  }

  return (
    <div>
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
    </div>
  );
}
