"use client";

import { useState } from "react";
import { activarFacturacionElectronica } from "./actions";
import { EncabezadoFactus } from "./encabezado-factus";

export function ActivarFactus({ facturacionSugerida }: { facturacionSugerida: string }) {
  const [facturacion, setFacturacion] = useState(facturacionSugerida);
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activar() {
    setError(null);
    setActivando(true);
    try {
      const res = await activarFacturacionElectronica(facturacion);
      if (!res.ok) {
        setError(res.error);
      }
      // Si ok, la propia acción redirige a esta misma página para mostrar
      // el estado "activa" — no hace falta nada más acá.
    } finally {
      setActivando(false);
    }
  }

  return (
    <div>
      <EncabezadoFactus tinte="neutral" />
      <p className="mb-6 text-sm text-gray-500">
        Servicio adicional y opcional, aparte de tu suscripción — no ocupa cupo de tu plan.
      </p>

      <div className="mb-6 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
        <p>
          <strong>$99 COP</strong> por cada factura electrónica que emitas, cobrado mensualmente
          según tu uso real.
        </p>
        <p>
          Más el <strong>certificado digital</strong>, obligatorio para poder facturar: elige cómo
          prefieres pagarlo abajo.
        </p>
        <p className="text-xs text-gray-500">
          Ambos se cobran con el mismo método de pago que ya tienes registrado para tu
          suscripción — no hace falta agregar una tarjeta nueva.
        </p>
      </div>

      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Facturación del certificado digital
        </label>
        <div className="flex gap-2">
          {[
            { value: "anual", label: "Anual — $150.000 (1 pago)" },
            { value: "mensual", label: "Mensual — $15.000/mes" },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFacturacion(f.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                facturacion === f.value
                  ? "border-accent bg-accent text-white"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 max-h-56 overflow-y-auto rounded-lg border border-gray-200 p-4 text-xs leading-relaxed text-gray-600">
        <p className="mb-2 font-medium text-gray-800">
          Resumen de las condiciones (Cláusula Décima Novena de tu contrato):
        </p>
        <p>
          Datum actúa como intermediario tecnológico, transmitiendo los datos de tus ventas a un
          proveedor autorizado por la DIAN, quien firma y transmite cada factura. Tú sigues siendo
          responsable de mantener vigente tu propio registro ante ese proveedor y ante la DIAN, y
          de la exactitud de los datos que ingreses para facturar. Puedes dejar de usar este
          servicio en cualquier momento avisándonos por escrito.
        </p>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={activar}
        disabled={activando}
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {activando ? "Activando..." : "Acepto y activo"}
      </button>
    </div>
  );
}
