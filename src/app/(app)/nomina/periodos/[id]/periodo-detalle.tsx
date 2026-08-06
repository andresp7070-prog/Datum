"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { marcarPeriodoPagado } from "../../actions";

type Periodo = {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_pago: string;
  estado: string;
};

type Detalle = {
  id: string;
  nombreEmpleado: string;
  cargo: string | null;
  salarioBase: number;
  auxilioTransporte: number;
  deduccionSalud: number;
  deduccionPension: number;
  totalDevengado: number;
  totalDeducido: number;
  netoPagado: number;
  totalAportesPatronales: number;
  totalPrestaciones: number;
  totalVacaciones: number;
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function formatoFecha(valor: string) {
  return new Date(`${valor}T00:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PeriodoNominaDetalle({ periodo, detalles }: { periodo: Periodo; detalles: Detalle[] }) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalNeto = detalles.reduce((s, d) => s + d.netoPagado, 0);
  const totalAportes = detalles.reduce((s, d) => s + d.totalAportesPatronales, 0);
  const totalPrestaciones = detalles.reduce((s, d) => s + d.totalPrestaciones, 0);
  const totalVacaciones = detalles.reduce((s, d) => s + d.totalVacaciones, 0);

  async function marcarPagado() {
    setError(null);
    setProcesando(true);
    const resultado = await marcarPeriodoPagado(periodo.id);
    setProcesando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/nomina/periodos" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver a Períodos
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">
            {formatoFecha(periodo.fecha_inicio)} — {formatoFecha(periodo.fecha_fin)}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Fecha de pago: {formatoFecha(periodo.fecha_pago)}</p>
        </div>
        <div className="text-right">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              periodo.estado === "pagado" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {periodo.estado === "pagado" ? "Pagada" : "Borrador"}
          </span>
          {periodo.estado === "borrador" && (
            <div className="mt-2">
              <button
                type="button"
                onClick={marcarPagado}
                disabled={procesando || detalles.length === 0}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {procesando ? "Marcando..." : "Marcar como pagada"}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {detalles.length === 0 ? (
        <p className="text-gray-400">
          No había ningún empleado activo vinculado en este rango de fechas.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-400">
              <tr>
                <th className="p-3 font-medium">Empleado</th>
                <th className="p-3 font-medium">Devengado</th>
                <th className="p-3 font-medium">Deducido</th>
                <th className="p-3 font-medium">Neto</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detalles.map((d) => (
                <tr key={d.id}>
                  <td className="p-3">
                    <p className="font-medium text-gray-900">{d.nombreEmpleado}</p>
                    <p className="text-xs text-gray-400">{d.cargo || "Sin cargo"}</p>
                  </td>
                  <td className="p-3 text-gray-700">{formatoMoneda(d.totalDevengado)}</td>
                  <td className="p-3 text-gray-700">{formatoMoneda(d.totalDeducido)}</td>
                  <td className="p-3 font-medium text-gray-900">{formatoMoneda(d.netoPagado)}</td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/nomina/periodos/${periodo.id}/${d.id}`}
                      className="text-xs text-accent hover:underline"
                    >
                      Ver desprendible
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-medium text-gray-900">
                <td className="p-3">Total</td>
                <td colSpan={2}></td>
                <td className="p-3">{formatoMoneda(totalNeto)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {detalles.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
          <div>
            <p className="text-xs text-gray-400">Neto a empleados</p>
            <p className="font-medium text-gray-900">{formatoMoneda(totalNeto)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Aportes patronales (lo que paga la empresa aparte)</p>
            <p className="font-medium text-gray-900">{formatoMoneda(totalAportes)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Cesantías, intereses y prima provisionados</p>
            <p className="font-medium text-gray-900">{formatoMoneda(totalPrestaciones)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Costo total del período</p>
            <p className="font-medium text-gray-900">
              {formatoMoneda(totalNeto + totalAportes + totalPrestaciones)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Vacaciones provisionadas (informativo, no es gasto)</p>
            <p className="font-medium text-gray-500">{formatoMoneda(totalVacaciones)}</p>
          </div>
        </div>
      )}
      {detalles.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          Las vacaciones no aparecen como gasto porque el empleado cobra el mismo salario de
          siempre en esos días — ya está contado en &ldquo;Neto a empleados&rdquo;. Regístralas
          en{" "}
          <Link href="/pyg/movimientos/nuevo" className="text-accent hover:underline">
            Gastos e ingresos
          </Link>{" "}
          solo si le pagas algo extra al tomarlas.
        </p>
      )}
    </div>
  );
}
