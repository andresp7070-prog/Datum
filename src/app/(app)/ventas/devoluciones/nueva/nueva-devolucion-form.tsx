"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  buscarVentaParaDevolucion,
  registrarDevolucion,
  type VentaEncontrada,
} from "../actions";

type SeleccionItem = {
  seleccionado: boolean;
  cantidad: number;
  estadoProducto: "buen_estado" | "danado";
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

export function NuevaDevolucionForm({
  ventaInicial,
  errorInicial,
}: {
  ventaInicial: VentaEncontrada | null;
  errorInicial: string | null;
}) {
  const router = useRouter();

  const [venta, setVenta] = useState<VentaEncontrada | null>(ventaInicial);
  const [numeroBusqueda, setNumeroBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(errorInicial);

  const [selecciones, setSelecciones] = useState<Record<string, SeleccionItem>>({});
  const [tipo, setTipo] = useState<"devolucion" | "garantia">("devolucion");
  const [motivo, setMotivo] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  async function buscar() {
    const numero = Number(numeroBusqueda);
    if (!numeroBusqueda.trim() || !numero || numero <= 0) {
      setErrorBusqueda("Escribe un número de venta válido.");
      return;
    }
    setErrorBusqueda(null);
    setBuscando(true);
    try {
      const resultado = await buscarVentaParaDevolucion({ numeroVenta: numero });
      if (resultado.error || !resultado.venta) {
        setErrorBusqueda(resultado.error ?? "No se encontró la venta.");
        return;
      }
      setVenta(resultado.venta);
    } finally {
      setBuscando(false);
    }
  }

  function actualizarSeleccion(ventaItemId: string, cambios: Partial<SeleccionItem>) {
    setSelecciones((actual) => ({
      ...actual,
      [ventaItemId]: {
        seleccionado: actual[ventaItemId]?.seleccionado ?? false,
        cantidad: actual[ventaItemId]?.cantidad ?? 1,
        estadoProducto: actual[ventaItemId]?.estadoProducto ?? "buen_estado",
        ...cambios,
      },
    }));
  }

  async function guardar() {
    if (!venta) return;
    setError(null);

    const itemsSeleccionados = venta.items
      .filter((item) => selecciones[item.ventaItemId]?.seleccionado)
      .map((item) => ({
        itemId: item.itemId,
        cantidad: selecciones[item.ventaItemId].cantidad,
        estadoProducto: selecciones[item.ventaItemId].estadoProducto,
      }));

    if (itemsSeleccionados.length === 0) {
      setError("Elige al menos un producto de esta venta.");
      return;
    }
    for (const item of itemsSeleccionados) {
      if (!item.cantidad || item.cantidad <= 0) {
        setError("La cantidad de cada producto debe ser mayor a cero.");
        return;
      }
    }

    setGuardando(true);
    try {
      const resultado = await registrarDevolucion({
        ventaId: venta.id,
        contactoId: venta.contactoId,
        tipo,
        motivo: motivo.trim(),
        items: itemsSeleccionados,
      });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setExito(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la devolución.");
    } finally {
      setGuardando(false);
    }
  }

  if (exito) {
    return (
      <div className="max-w-2xl">
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Devolución registrada como pendiente. Se resuelve desde la lista de Devoluciones.
        </p>
        <button
          type="button"
          onClick={() => router.push("/ventas/devoluciones")}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Ir a Devoluciones
        </button>
      </div>
    );
  }

  if (!venta) {
    return (
      <div className="max-w-md">
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Nueva devolución</h1>
        <label className="mb-1 block text-sm font-medium text-gray-700">Número de venta</label>
        <div className="flex gap-2">
          <input
            value={numeroBusqueda}
            onChange={(e) => setNumeroBusqueda(e.target.value.replace(/\D/g, ""))}
            placeholder="Ej. 47"
            inputMode="numeric"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={buscar}
            disabled={buscando}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </div>
        {errorBusqueda && <p className="mt-2 text-sm text-red-600">{errorBusqueda}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Nueva devolución</h1>
      <p className="mb-6 text-sm text-gray-500">
        Venta #{venta.numeroVenta ?? "—"} · {new Date(venta.fecha).toLocaleString("es-CO")} ·{" "}
        {venta.clienteNombre ?? "Cliente sin nombre"} · {formatoMoneda(venta.monto)}
      </p>

      <section className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Productos de esta venta</h2>
        <div className="space-y-3">
          {venta.items.map((item) => {
            const seleccion = selecciones[item.ventaItemId];
            const marcado = seleccion?.seleccionado ?? false;
            return (
              <div key={item.ventaItemId} className="rounded-lg border border-gray-200 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={(e) =>
                      actualizarSeleccion(item.ventaItemId, {
                        seleccionado: e.target.checked,
                        cantidad: item.cantidad,
                      })
                    }
                  />
                  <span className="font-medium text-gray-900">{item.nombre}</span>
                  <span className="text-gray-400">(vendidos {item.cantidad})</span>
                </label>

                {marcado && (
                  <div className="mt-3 grid grid-cols-2 gap-3 pl-6">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Cantidad devuelta
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={item.cantidad}
                        step={1}
                        value={seleccion.cantidad}
                        onChange={(e) =>
                          actualizarSeleccion(item.ventaItemId, {
                            cantidad: Math.min(item.cantidad, Number(e.target.value) || 1),
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Estado del producto
                      </label>
                      <select
                        value={seleccion.estadoProducto}
                        onChange={(e) =>
                          actualizarSeleccion(item.ventaItemId, {
                            estadoProducto: e.target.value as "buen_estado" | "danado",
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                      >
                        <option value="buen_estado">Buen estado — vuelve al inventario</option>
                        <option value="danado">Dañado — no vuelve al inventario</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Motivo</h2>
        <div className="mb-4 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={tipo === "devolucion"}
              onChange={() => setTipo("devolucion")}
            />
            Devolución — el cliente se arrepintió
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={tipo === "garantia"}
              onChange={() => setTipo("garantia")}
            />
            Garantía — producto defectuoso
          </label>
        </div>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Detalle opcional"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </section>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Registrar devolución"}
      </button>
    </div>
  );
}
