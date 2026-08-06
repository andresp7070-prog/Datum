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

export type RecetaDetalle = {
  unidadesProducibles: number;
  insumos: {
    nombre: string;
    unidad: string;
    stockDisponible: number;
    cantidadNecesaria: number;
  }[];
};

function filtrarPorTexto(items: Item[], busqueda: string) {
  const q = sinTildes(busqueda.trim());
  if (!q) return [];
  return items
    .filter((item) => sinTildes(item.nombre).includes(q) || sinTildes(item.categoria ?? "").includes(q))
    .slice(0, 8);
}

function TarjetaReceta({ item, detalle }: { item: Item; detalle: RecetaDetalle | undefined }) {
  const [abierta, setAbierta] = useState(false);

  const producibles = detalle && Number.isFinite(detalle.unidadesProducibles)
    ? detalle.unidadesProducibles
    : 0;

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <p className="text-sm font-medium text-gray-900">{item.nombre}</p>
          <p className="text-xs text-gray-400">{item.categoria || "Sin categoría"}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-sm font-medium ${producibles > 0 ? "text-gray-900" : "text-red-600"}`}>
              {producibles} unidad{producibles === 1 ? "" : "es"} posible{producibles === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-gray-400">con el stock actual</p>
          </div>
          <span className={`text-gray-400 transition-transform ${abierta ? "rotate-180" : ""}`}>▾</span>
        </div>
      </button>

      {abierta && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">Insumos de esta receta</p>
            <Link
              href={`/inventario/${item.id}/receta`}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Editar receta
            </Link>
          </div>
          {!detalle || detalle.insumos.length === 0 ? (
            <p className="text-sm text-gray-400">Sin insumos configurados.</p>
          ) : (
            <ul className="divide-y divide-gray-200 text-sm">
              {detalle.insumos.map((insumo) => (
                <li key={insumo.nombre} className="flex items-center justify-between py-1.5">
                  <span className="text-gray-700">{insumo.nombre}</span>
                  <span className="text-right text-gray-500">
                    <span className="text-gray-900">
                      {insumo.stockDisponible} {insumo.unidad}
                    </span>{" "}
                    en stock · usa {insumo.cantidadNecesaria} {insumo.unidad} por unidad
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function DirectorioRecetas({
  items,
  detalles,
}: {
  items: Item[];
  detalles: Record<string, RecetaDetalle>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  const configuradas = items.filter((item) => item.insumos > 0);
  const sugerencias = filtrarPorTexto(items, busqueda);

  return (
    <div>
      <InventarioTabs />

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Recetas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Solo para productos que se arman combinando otros (ej. una hamburguesa hecha de
          carne, pan, lechuga, tomate y queso). Los ingredientes sueltos no necesitan receta.
        </p>
      </div>

      <div className="relative mb-6 max-w-xs">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Configurar receta de un producto
        </label>
        <input
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setMostrarSugerencias(true);
          }}
          onFocus={() => setMostrarSugerencias(sugerencias.length > 0)}
          onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
          placeholder="Ej. Hamburguesa"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        {mostrarSugerencias && busqueda.trim() && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
            {sugerencias.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/inventario/${item.id}/receta`}
                  className="block px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  {item.nombre}
                  {item.insumos > 0 && (
                    <span className="ml-1 text-xs text-gray-400">(ya tiene receta)</span>
                  )}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={`/inventario/nuevo?nombre=${encodeURIComponent(busqueda.trim())}&volver=receta`}
                className="block border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                + Crear &ldquo;{busqueda.trim()}&rdquo; como producto nuevo
              </Link>
            </li>
          </ul>
        )}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-gray-900">Recetas configuradas</h2>
      {configuradas.length === 0 ? (
        <p className="text-gray-400">
          Aún no has configurado ninguna receta. Busca arriba el producto que se arma
          combinando otros (ej. &ldquo;Hamburguesa&rdquo;) para empezar.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {configuradas.map((item) => (
            <TarjetaReceta key={item.id} item={item} detalle={detalles[item.id]} />
          ))}
        </ul>
      )}
    </div>
  );
}
