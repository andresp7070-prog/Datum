"use client";

import { useState } from "react";
import Link from "next/link";
import { sinTildes } from "@/lib/texto";

const NOMBRE_MODULO: Record<string, string> = {
  ventas: "Ventas",
  crm: "CRM",
  inventario: "Inventario",
  pyg: "Estado P y G",
  insights: "Panel de control",
  promociones: "Promociones",
  nomina: "Nómina",
};

const NOMBRE_TIPO_NEGOCIO: Record<string, string> = {
  aseo: "Aseo",
  ropa: "Ropa",
  restaurante: "Restaurante",
  cafeteria: "Cafetería",
  belleza: "Belleza",
  ferreteria: "Ferretería",
  taller: "Taller",
  tienda: "Tienda",
  papeleria: "Papelería",
  otro: "Otro",
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

type Empresa = {
  id: string;
  nombre: string;
  tipo_negocio: string | null;
  modulos_activos: string[] | null;
  monto_mensual: number | null;
  activa: boolean;
  created_at: string;
};

export function BuscadorEmpresas({ empresas }: { empresas: Empresa[] }) {
  const [busqueda, setBusqueda] = useState("");

  const q = sinTildes(busqueda.trim());
  const filtradas = q ? empresas.filter((empresa) => sinTildes(empresa.nombre).includes(q)) : empresas;

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar empresa por nombre"
        className="mb-4 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      />

      {filtradas.length === 0 ? (
        <p className="text-sm text-gray-400">
          {empresas.length === 0 ? "Todavía no hay empresas registradas." : "No hay empresas que coincidan."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400">
              <tr>
                <th className="px-2 py-2">Nombre</th>
                <th className="px-2 py-2">Tipo de negocio</th>
                <th className="px-2 py-2">Módulos</th>
                <th className="px-2 py-2">Mensualidad</th>
                <th className="px-2 py-2">Desde</th>
                <th className="px-2 py-2">Estado</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtradas.map((empresa) => (
                <tr key={empresa.id}>
                  <td className="px-2 py-2 text-gray-900">{empresa.nombre}</td>
                  <td className="px-2 py-2 text-gray-500">
                    {empresa.tipo_negocio ? NOMBRE_TIPO_NEGOCIO[empresa.tipo_negocio] ?? empresa.tipo_negocio : "—"}
                  </td>
                  <td className="px-2 py-2 text-gray-500">
                    {(empresa.modulos_activos ?? [])
                      .map((m: string) => NOMBRE_MODULO[m] ?? m)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-2 py-2 text-gray-500">
                    {empresa.monto_mensual ? formatoMoneda(Number(empresa.monto_mensual)) : "—"}
                  </td>
                  <td className="px-2 py-2 text-gray-500">
                    {new Date(empresa.created_at).toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        empresa.activa
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {empresa.activa ? "Activa" : "Desactivada"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Link
                      href={`/admin/clientes/${empresa.id}`}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Ver empresa →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
