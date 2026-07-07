"use client";

import { useState } from "react";
import Link from "next/link";
import { sinTildes } from "@/lib/texto";
import { InventarioTabs } from "../inventario-tabs";

type Item = {
  id: string;
  nombre: string;
  categoria: string | null;
  insumos: number;
};

export function DirectorioRecetas({ items }: { items: Item[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = items.filter((item) => {
    const q = sinTildes(busqueda.trim());
    if (!q) return true;
    return sinTildes(item.nombre).includes(q) || sinTildes(item.categoria ?? "").includes(q);
  });

  return (
    <div>
      <InventarioTabs />

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Recetas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configura qué insumos se descuentan automáticamente al producir cada producto.
        </p>
      </div>

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o categoría"
        className="mb-4 w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      />

      {filtrados.length === 0 ? (
        <p className="text-gray-400">No hay productos que coincidan.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/inventario/${item.id}/receta`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.nombre}</p>
                  <p className="text-xs text-gray-400">{item.categoria || "Sin categoría"}</p>
                </div>
                <p className="text-sm text-gray-500">
                  {item.insumos > 0
                    ? `${item.insumos} insumo${item.insumos === 1 ? "" : "s"} configurado${item.insumos === 1 ? "" : "s"}`
                    : "Sin receta"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
