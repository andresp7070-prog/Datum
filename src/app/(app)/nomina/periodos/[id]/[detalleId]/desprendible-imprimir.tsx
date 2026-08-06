"use client";

import Link from "next/link";

export function DesprendibleImprimir({
  empresaNombre,
  empleadoNombre,
  empleadoCedula,
  empleadoCargo,
  periodoTexto,
  fechaPagoTexto,
  estado,
  volverHref,
  salarioBase,
  auxilioTransporte,
  totalDevengado,
  deduccionSalud,
  deduccionPension,
  totalDeducido,
  netoPagado,
}: {
  empresaNombre: string;
  empleadoNombre: string;
  empleadoCedula: string | null;
  empleadoCargo: string | null;
  periodoTexto: string;
  fechaPagoTexto: string;
  estado: string;
  volverHref: string;
  salarioBase: string;
  auxilioTransporte: string;
  totalDevengado: string;
  deduccionSalud: string;
  deduccionPension: string;
  totalDeducido: string;
  netoPagado: string;
}) {
  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={volverHref} className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver al período
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Imprimir / Descargar PDF
        </button>
      </div>

      <div className="rounded-xl border-2 border-gray-200 p-6">
        <div className="mb-4 text-center">
          <p className="text-sm font-semibold text-gray-900">{empresaNombre}</p>
          <p className="text-xs text-gray-500">Desprendible de pago</p>
          <p className="text-xs text-gray-400">
            {periodoTexto} · Pago: {fechaPagoTexto}
            {estado === "borrador" && " · Borrador, aún no pagado"}
          </p>
        </div>

        <div className="mb-4 border-t border-gray-200 pt-4">
          <p className="text-sm font-medium text-gray-900">{empleadoNombre}</p>
          {empleadoCedula && <p className="text-xs text-gray-500">C.C. {empleadoCedula}</p>}
          {empleadoCargo && <p className="text-xs text-gray-500">{empleadoCargo}</p>}
        </div>

        <div className="border-t border-gray-200 pt-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">Devengado</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Salario</span>
              <span className="text-gray-900">{salarioBase}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Auxilio de transporte</span>
              <span className="text-gray-900">{auxilioTransporte}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-1 font-medium">
              <span className="text-gray-700">Total devengado</span>
              <span className="text-gray-900">{totalDevengado}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">Deducciones</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Salud (4%)</span>
              <span className="text-gray-900">{deduccionSalud}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pensión (4%)</span>
              <span className="text-gray-900">{deduccionPension}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-1 font-medium">
              <span className="text-gray-700">Total deducido</span>
              <span className="text-gray-900">{totalDeducido}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-between rounded-lg bg-gray-50 p-3 text-base font-semibold">
          <span className="text-gray-900">Neto a pagar</span>
          <span className="text-gray-900">{netoPagado}</span>
        </div>
      </div>
    </div>
  );
}
