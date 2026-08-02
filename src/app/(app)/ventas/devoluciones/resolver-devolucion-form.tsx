"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EntradaMoneda } from "@/components/campo-moneda";
import { ahoraFecha } from "@/lib/fecha";
import { resolverDevolucion } from "./actions";

type ItemCatalogo = {
  id: string;
  nombre: string;
  cantidad: number;
  precio_venta: number | null;
};

export function ResolverDevolucionForm({
  devolucionId,
  tieneCliente,
  catalogo,
}: {
  devolucionId: string;
  tieneCliente: boolean;
  catalogo: ItemCatalogo[];
}) {
  const router = useRouter();

  const [decision, setDecision] = useState<"aceptada" | "rechazada" | null>(null);
  const [resolucion, setResolucion] = useState<"reembolso" | "cambio" | "cupon">("reembolso");

  const [montoReembolso, setMontoReembolso] = useState("");
  const [itemCambioId, setItemCambioId] = useState("");
  const [cantidadCambio, setCantidadCambio] = useState("1");
  const [cuponMonto, setCuponMonto] = useState("");
  const [cuponVencimiento, setCuponVencimiento] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    if (!decision) return;
    setError(null);

    if (decision === "aceptada") {
      if (resolucion === "reembolso") {
        const monto = Number(montoReembolso) || 0;
        if (!montoReembolso.trim() || monto <= 0) {
          setError("El monto del reembolso debe ser mayor a cero.");
          return;
        }
      }
      if (resolucion === "cambio") {
        const cantidad = Number(cantidadCambio) || 0;
        if (!itemCambioId) {
          setError("Elige el producto de reemplazo.");
          return;
        }
        if (cantidad <= 0) {
          setError("La cantidad del producto de reemplazo debe ser mayor a cero.");
          return;
        }
      }
      if (resolucion === "cupon") {
        if (!tieneCliente) {
          setError("Esta devolución no tiene cliente asociado — no se puede crear un cupón.");
          return;
        }
        const monto = Number(cuponMonto) || 0;
        if (!cuponMonto.trim() || monto <= 0) {
          setError("El monto del cupón debe ser mayor a cero.");
          return;
        }
      }
    }

    setGuardando(true);
    try {
      const resultado = await resolverDevolucion({
        devolucionId,
        estado: decision,
        resolucion: decision === "aceptada" ? resolucion : undefined,
        montoReembolso:
          decision === "aceptada" && resolucion === "reembolso" ? Number(montoReembolso) : undefined,
        itemCambioId: decision === "aceptada" && resolucion === "cambio" ? itemCambioId : undefined,
        cantidadCambio:
          decision === "aceptada" && resolucion === "cambio" ? Number(cantidadCambio) : undefined,
        cuponMonto: decision === "aceptada" && resolucion === "cupon" ? Number(cuponMonto) : undefined,
        cuponVencimiento:
          decision === "aceptada" && resolucion === "cupon" && cuponVencimiento
            ? cuponVencimiento
            : undefined,
      });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  if (!decision) {
    return (
      <div className="mt-3 flex gap-2 border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={() => setDecision("aceptada")}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
        >
          Aceptar
        </button>
        <button
          type="button"
          onClick={() => setDecision("rechazada")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Rechazar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
      {decision === "rechazada" ? (
        <p className="text-sm text-gray-700">Se marcará como rechazada.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={resolucion === "reembolso"}
                onChange={() => setResolucion("reembolso")}
              />
              Reembolso
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={resolucion === "cambio"}
                onChange={() => setResolucion("cambio")}
              />
              Cambio de producto
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={resolucion === "cupon"}
                onChange={() => setResolucion("cupon")}
              />
              Cupón para compra futura
            </label>
          </div>

          {resolucion === "reembolso" && (
            <div className="max-w-40">
              <label className="mb-1 block text-xs font-medium text-gray-700">Monto</label>
              <EntradaMoneda
                value={montoReembolso}
                onChange={setMontoReembolso}
                className="w-full rounded-lg border border-gray-300 py-2 pl-6 pr-2 text-sm focus:border-gray-500 focus:outline-none"
              />
            </div>
          )}

          {resolucion === "cambio" && (
            <div className="grid max-w-md grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Producto de reemplazo
                </label>
                <select
                  value={itemCambioId}
                  onChange={(e) => setItemCambioId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                >
                  <option value="">Elige un producto</option>
                  {catalogo.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre} (quedan {item.cantidad})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cantidadCambio}
                  onChange={(e) => setCantidadCambio(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {resolucion === "cupon" &&
            (tieneCliente ? (
              <div className="grid max-w-md grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Monto</label>
                  <EntradaMoneda
                    value={cuponMonto}
                    onChange={setCuponMonto}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-6 pr-2 text-sm focus:border-gray-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Vence (opcional)
                  </label>
                  <input
                    type="date"
                    min={ahoraFecha()}
                    value={cuponVencimiento}
                    onChange={(e) => setCuponVencimiento(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-600">
                Esta devolución no tiene cliente asociado — no se puede crear un cupón.
              </p>
            ))}
        </>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={guardando}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => setDecision(null)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
