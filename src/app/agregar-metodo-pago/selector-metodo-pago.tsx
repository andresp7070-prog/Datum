"use client";

import { useState } from "react";
import { FormularioMetodoPago } from "./formulario-metodo-pago";
import { FormularioBancolombia } from "./formulario-bancolombia";

// Envuelve los dos flujos sin tocar FormularioMetodoPago por dentro —
// ese componente ya quedó muy ajustado a las rarezas del widget de
// Wompi (ver sus propios comentarios), así que cada pestaña maneja su
// propio estado de principio a fin, sin compartir nada entre sí.
export function SelectorMetodoPago({
  llavePublica,
  acceptanceToken,
  acceptPersonalAuth,
  permalinkTerminos,
  permalinkDatosPersonales,
}: {
  llavePublica: string;
  acceptanceToken: string;
  acceptPersonalAuth: string;
  permalinkTerminos: string;
  permalinkDatosPersonales: string;
}) {
  const [tab, setTab] = useState<"tarjeta" | "bancolombia">("tarjeta");

  return (
    <div>
      <div className="mb-5 flex rounded-lg border border-gray-200 p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab("tarjeta")}
          className={`flex-1 rounded-md py-2 font-medium transition ${
            tab === "tarjeta" ? "bg-accent text-white" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Tarjeta
        </button>
        <button
          type="button"
          onClick={() => setTab("bancolombia")}
          className={`flex-1 rounded-md py-2 font-medium transition ${
            tab === "bancolombia" ? "bg-accent text-white" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Bancolombia
        </button>
      </div>

      {tab === "tarjeta" ? (
        <FormularioMetodoPago
          llavePublica={llavePublica}
          acceptanceToken={acceptanceToken}
          acceptPersonalAuth={acceptPersonalAuth}
          permalinkTerminos={permalinkTerminos}
          permalinkDatosPersonales={permalinkDatosPersonales}
        />
      ) : (
        <FormularioBancolombia
          permalinkTerminos={permalinkTerminos}
          permalinkDatosPersonales={permalinkDatosPersonales}
        />
      )}
    </div>
  );
}
