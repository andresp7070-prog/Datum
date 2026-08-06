"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generarPeriodoNomina } from "../../actions";

function primerDiaDelMes() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
}

function ultimoDiaDelMes() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

export function GenerarNominaForm() {
  const router = useRouter();

  const [fechaInicio, setFechaInicio] = useState(primerDiaDelMes());
  const [fechaFin, setFechaFin] = useState(ultimoDiaDelMes());
  const [fechaPago, setFechaPago] = useState(hoyIso());

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);

    if (!fechaInicio || !fechaFin || !fechaPago) {
      setError("Todas las fechas son obligatorias.");
      return;
    }
    if (fechaFin < fechaInicio) {
      setError("La fecha de fin no puede ser antes de la fecha de inicio.");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await generarPeriodoNomina({ fechaInicio, fechaFin, fechaPago });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      router.push(`/nomina/periodos/${resultado.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar la nómina.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Generar nómina</h1>
        <Link href="/nomina/periodos" className="text-sm text-gray-500 hover:text-gray-700">
          Volver
        </Link>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        Calcula el pago de todos los empleados activos en este rango de fechas: salario, auxilio de
        transporte, y descuentos de salud y pensión.
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Desde *</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Hasta *</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de pago *</label>
          <input
            type="date"
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <p className="text-xs text-gray-400">* Campos obligatorios</p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Generando..." : "Generar"}
      </button>
    </div>
  );
}
