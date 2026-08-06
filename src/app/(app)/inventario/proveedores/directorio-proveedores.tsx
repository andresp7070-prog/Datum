"use client";

import { useState } from "react";
import { etiquetaFrecuenciaPago } from "@/lib/proveedores";

type Proveedor = {
  id: string;
  nombre: string;
  telefono: string | null;
  frecuencia_pago: string;
  dia_semana_pago: string | null;
  dias_personalizado: number | null;
};

export type ResumenProveedor = {
  ultima_compra: string | null;
  costo_promedio: number | null;
  categoria_mas_comprada: string | null;
  rentabilidad: number;
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function formatoFecha(fechaIso: string) {
  return new Date(fechaIso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function TarjetaProveedor({
  proveedor,
  resumen,
}: {
  proveedor: Proveedor;
  resumen: ResumenProveedor | undefined;
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <p className="text-sm font-medium text-gray-900">{proveedor.nombre}</p>
          <p className="text-xs text-gray-400">{proveedor.telefono || "Sin teléfono"}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">
            {etiquetaFrecuenciaPago(
              proveedor.frecuencia_pago,
              proveedor.dia_semana_pago,
              proveedor.dias_personalizado,
            )}
          </span>
          <span className={`text-gray-400 transition-transform ${abierta ? "rotate-180" : ""}`}>▾</span>
        </div>
      </button>

      {abierta && (
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-400">Última compra</p>
            <p className="font-medium text-gray-900">
              {resumen?.ultima_compra ? formatoFecha(resumen.ultima_compra) : "Sin compras todavía"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Costo promedio pagado</p>
            <p className="font-medium text-gray-900">
              {resumen?.costo_promedio ? formatoMoneda(resumen.costo_promedio) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Categoría más comprada</p>
            <p className="font-medium text-gray-900">{resumen?.categoria_mas_comprada || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Rentabilidad generada</p>
            <p className="font-medium text-gray-900">{formatoMoneda(resumen?.rentabilidad ?? 0)}</p>
          </div>
        </div>
      )}
    </li>
  );
}

export function DirectorioProveedores({
  proveedores,
  resumenes,
}: {
  proveedores: Proveedor[];
  resumenes: Record<string, ResumenProveedor>;
}) {
  if (proveedores.length === 0) {
    return <p className="text-gray-400">Todavía no tienes proveedores registrados.</p>;
  }

  return (
    <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
      {proveedores.map((p) => (
        <TarjetaProveedor key={p.id} proveedor={p} resumen={resumenes[p.id]} />
      ))}
    </ul>
  );
}
