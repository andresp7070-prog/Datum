"use client";

import { useState } from "react";
import { enviarCorreoDePrueba, type TipoCorreoPrueba } from "./actions";

const TIPOS: { tipo: TipoCorreoPrueba; nombre: string; descripcion: string }[] = [
  { tipo: "bienvenida", nombre: "Bienvenida", descripcion: "El que recibe una empresa al crear su cuenta." },
  { tipo: "prueba_activada", nombre: "Prueba activada", descripcion: "Confirma que la prueba de 15 días ya empezó." },
  { tipo: "reunion_agendada", nombre: "Reunión agendada", descripcion: "Confirma una reunión agendada desde la landing." },
  { tipo: "fin_prueba", nombre: "Aviso de fin de prueba", descripcion: "Avisa que quedan 3 días del período gratuito." },
  { tipo: "prueba_vencida", nombre: "Prueba vencida", descripcion: "Avisa que los 15 días ya se cumplieron." },
  { tipo: "metodo_pago_agregado", nombre: "Método de pago agregado", descripcion: "Confirma que se guardó una tarjeta o cuenta." },
  { tipo: "pago_realizado", nombre: "Pago realizado", descripcion: "Confirma un cobro exitoso." },
  {
    tipo: "pago_realizado_desglosado",
    nombre: "Pago realizado (desglosado)",
    descripcion: "Igual, pero con más de un concepto en el mismo cobro.",
  },
  { tipo: "pago_fallido", nombre: "Pago fallido", descripcion: "Avisa que un cobro no pasó." },
  { tipo: "cambio_plan", nombre: "Cambio de plan", descripcion: "Avisa que el plan de la empresa cambió." },
  { tipo: "contrasena_actualizada", nombre: "Contraseña actualizada", descripcion: "Confirma un cambio de contraseña voluntario." },
];

export function CorreosForm() {
  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState<TipoCorreoPrueba | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<TipoCorreoPrueba | null>(null);

  async function enviar(tipo: TipoCorreoPrueba) {
    setError(null);
    setExito(null);

    if (!correo.trim()) {
      setError("Escribe un correo destino primero.");
      return;
    }

    setEnviando(tipo);
    try {
      const resultado = await enviarCorreoDePrueba({ correo, tipo });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setExito(tipo);
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Probar correos</h1>
      <p className="mb-6 text-sm text-gray-500">
        Manda cualquiera de estos correos a un destino de prueba, con datos de ejemplo. No crea ni
        cambia nada en la base de datos — solo envía el correo.
      </p>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Correo destino</label>
        <input
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
        {TIPOS.map(({ tipo, nombre, descripcion }) => (
          <li key={tipo} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{nombre}</p>
              <p className="text-xs text-gray-400">{descripcion}</p>
              {exito === tipo && <p className="mt-1 text-xs text-green-600">Enviado correctamente.</p>}
            </div>
            <button
              type="button"
              onClick={() => enviar(tipo)}
              disabled={enviando !== null}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {enviando === tipo ? "Enviando..." : "Enviar"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
