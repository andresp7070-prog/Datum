"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { borrarLead } from "./actions";

export function EliminarLead({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function borrar() {
    setError(null);
    setBorrando(true);
    const resultado = await borrarLead(leadId);
    setBorrando(false);
    if (resultado.error) {
      setError(resultado.error);
      setConfirmando(false);
      return;
    }
    router.push("/admin/leads");
  }

  if (confirmando) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">¿Borrar este lead?</span>
          <button
            type="button"
            onClick={borrar}
            disabled={borrando}
            className="font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {borrando ? "..." : "Sí, borrar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            disabled={borrando}
            className="text-gray-400 hover:text-gray-700"
          >
            Cancelar
          </button>
        </span>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      className="text-xs text-gray-400 hover:text-red-600"
    >
      Eliminar lead
    </button>
  );
}
