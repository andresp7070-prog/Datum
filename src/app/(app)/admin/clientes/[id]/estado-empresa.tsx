"use client";

import { useState } from "react";
import { cambiarEstadoEmpresa } from "./actions";

export function EstadoEmpresa({
  empresaId,
  activaInicial,
  nombreEmpresa,
}: {
  empresaId: string;
  activaInicial: boolean;
  nombreEmpresa: string;
}) {
  const [activa, setActiva] = useState(activaInicial);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alternar() {
    const nuevoEstado = !activa;
    if (!nuevoEstado) {
      const confirmado = window.confirm(
        `¿Desactivar ${nombreEmpresa}? Nadie de esa empresa va a poder iniciar sesión hasta que la reactives.`,
      );
      if (!confirmado) return;
    }

    setError(null);
    setCambiando(true);
    try {
      const res = await cambiarEstadoEmpresa(empresaId, nuevoEstado);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setActiva(nuevoEstado);
    } finally {
      setCambiando(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          activa ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}
      >
        {activa ? "Activa" : "Desactivada"}
      </span>
      <button
        type="button"
        onClick={alternar}
        disabled={cambiando}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
          activa
            ? "border border-red-300 text-red-700 hover:bg-red-50"
            : "bg-accent text-white hover:bg-accent-hover"
        }`}
      >
        {cambiando ? "Guardando..." : activa ? "Desactivar" : "Activar"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
