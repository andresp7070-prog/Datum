"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sinTildes } from "@/lib/texto";
import { guardarReceta } from "../actions";

type Insumo = {
  id: string;
  nombre: string;
  unidad: string;
};

type LineaReceta = {
  key: string;
  insumoId: string;
  busqueda: string;
  mostrarSugerencias: boolean;
  cantidad: string;
};

function nuevaLinea(): LineaReceta {
  return {
    key: crypto.randomUUID(),
    insumoId: "",
    busqueda: "",
    mostrarSugerencias: false,
    cantidad: "",
  };
}

function filtrarInsumos(insumos: Insumo[], query: string) {
  const q = sinTildes(query.trim());
  if (!q) return [];
  return insumos.filter((insumo) => sinTildes(insumo.nombre).includes(q)).slice(0, 8);
}

export function RecetaForm({
  itemResultante,
  insumosDisponibles,
  recetaInicial,
}: {
  itemResultante: { id: string; nombre: string };
  insumosDisponibles: Insumo[];
  recetaInicial: { item_insumo_id: string; cantidad_insumo: number }[];
}) {
  const router = useRouter();

  const lineasIniciales: LineaReceta[] = recetaInicial.map((fila) => {
    const insumo = insumosDisponibles.find((i) => i.id === fila.item_insumo_id);
    return {
      key: crypto.randomUUID(),
      insumoId: fila.item_insumo_id,
      busqueda: insumo?.nombre ?? "",
      mostrarSugerencias: false,
      cantidad: String(fila.cantidad_insumo),
    };
  });

  const [lineas, setLineas] = useState<LineaReceta[]>(
    lineasIniciales.length > 0 ? lineasIniciales : [nuevaLinea()],
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizarLinea(key: string, cambios: Partial<LineaReceta>) {
    setLineas((actual) =>
      actual.map((linea) => (linea.key === key ? { ...linea, ...cambios } : linea)),
    );
  }

  function buscarInsumo(key: string, texto: string) {
    actualizarLinea(key, { busqueda: texto, insumoId: "", mostrarSugerencias: true });
  }

  function seleccionarInsumo(key: string, insumo: Insumo) {
    actualizarLinea(key, {
      insumoId: insumo.id,
      busqueda: insumo.nombre,
      mostrarSugerencias: false,
    });
  }

  function agregarLinea() {
    setLineas((actual) => [...actual, nuevaLinea()]);
  }

  function quitarLinea(key: string) {
    setLineas((actual) => actual.filter((linea) => linea.key !== key));
  }

  async function guardar() {
    setError(null);

    const lineasValidas = lineas.filter((linea) => linea.insumoId && linea.cantidad.trim());
    for (const linea of lineasValidas) {
      const cantidadNum = Number(linea.cantidad);
      if (Number.isNaN(cantidadNum) || cantidadNum <= 0) {
        setError("Cada insumo necesita una cantidad mayor a cero.");
        return;
      }
    }

    setGuardando(true);
    try {
      await guardarReceta({
        itemResultanteId: itemResultante.id,
        lineas: lineasValidas.map((linea) => ({
          insumoId: linea.insumoId,
          cantidad: Number(linea.cantidad),
        })),
      });
      router.push(`/inventario/${itemResultante.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la receta.");
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Receta</h1>
      <p className="mb-6 text-sm text-gray-500">
        Insumos que se descuentan automáticamente al producir una unidad de{" "}
        <span className="font-medium text-gray-700">{itemResultante.nombre}</span>.
      </p>

      <div className="space-y-3">
        {lineas.map((linea) => {
          const insumoSeleccionado = insumosDisponibles.find((i) => i.id === linea.insumoId);
          return (
            <div key={linea.key} className="grid grid-cols-12 items-end gap-2">
              <div className="relative col-span-7">
                <label className="mb-1 block text-xs font-medium text-gray-700">Insumo</label>
                <input
                  value={linea.busqueda}
                  onChange={(e) => buscarInsumo(linea.key, e.target.value)}
                  onFocus={() => actualizarLinea(linea.key, { mostrarSugerencias: true })}
                  onBlur={() =>
                    setTimeout(() => actualizarLinea(linea.key, { mostrarSugerencias: false }), 150)
                  }
                  placeholder="Busca un producto del inventario"
                  className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                />
                {linea.mostrarSugerencias &&
                  filtrarInsumos(insumosDisponibles, linea.busqueda).length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-sm">
                      {filtrarInsumos(insumosDisponibles, linea.busqueda).map((insumo) => (
                        <li key={insumo.id}>
                          <button
                            type="button"
                            onMouseDown={() => seleccionarInsumo(linea.key, insumo)}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            {insumo.nombre}
                            <span className="ml-2 text-gray-400">{insumo.unidad}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
              <div className="col-span-4">
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Cantidad {insumoSeleccionado ? `(${insumoSeleccionado.unidad})` : ""}
                </label>
                <input
                  type="number"
                  min={0}
                  value={linea.cantidad}
                  onChange={(e) => actualizarLinea(linea.key, { cantidad: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => quitarLinea(linea.key)}
                  className="text-sm text-red-500 hover:text-red-700"
                  aria-label="Quitar insumo"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={agregarLinea}
        className="mt-3 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        + Agregar insumo
      </button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar receta"}
      </button>
    </div>
  );
}
