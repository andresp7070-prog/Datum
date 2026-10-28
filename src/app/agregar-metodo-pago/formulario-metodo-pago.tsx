"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type DatosWompiJs = { sessionId: string; deviceData: { deviceID: string } };

// Librería antifraude de Wompi (fingerprinting) — opcional pero
// recomendada por ellos en toda página donde se cree una transacción o
// fuente de pago. Expone window.$wompi una vez cargada.
declare global {
  interface Window {
    $wompi?: {
      initialize: (callback: (data: DatosWompiJs, error: unknown) => void) => void;
    };
  }
}

export function FormularioMetodoPago({
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
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const contenedorBotonRef = useRef<HTMLDivElement>(null);
  const listoParaPagar = aceptaTerminos && aceptaDatos;

  // El botón real de Wompi (el que de verdad tokeniza la tarjeta) solo se
  // agrega al DOM una vez las dos casillas están marcadas — así no hay
  // forma de llegar a escribir la tarjeta sin haber aceptado antes los
  // términos de Wompi, como exige su documentación de "Tokens de
  // aceptación". Se agrega con un <script> creado a mano (no vía JSX)
  // porque los navegadores solo ejecutan un <script src> insertado así,
  // no uno puesto con innerHTML.
  useEffect(() => {
    if (!listoParaPagar || !contenedorBotonRef.current) return;
    const script = document.createElement("script");
    script.src = "https://checkout.wompi.co/widget.js";
    script.setAttribute("data-render", "button");
    script.setAttribute("data-widget-operation", "tokenize");
    script.setAttribute("data-public-key", llavePublica);
    const contenedor = contenedorBotonRef.current;
    contenedor.appendChild(script);
    return () => {
      contenedor.replaceChildren();
    };
  }, [listoParaPagar, llavePublica]);

  return (
    <>
      <Script
        src="https://wompijs.wompi.com/libs/js/v1.js"
        data-public-key={llavePublica}
        strategy="afterInteractive"
        onLoad={() => {
          window.$wompi?.initialize((data, error) => {
            if (!error && data) {
              setSessionId(data.sessionId);
              setDeviceId(data.deviceData.deviceID);
            }
          });
        }}
      />

      <div className="mb-5 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={aceptaTerminos}
            onChange={(e) => setAceptaTerminos(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Leí y acepto los{" "}
            <a
              href={permalinkTerminos}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Términos y condiciones de Wompi
            </a>
            , la pasarela de pago que procesa tu tarjeta.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={aceptaDatos}
            onChange={(e) => setAceptaDatos(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Autorizo el{" "}
            <a
              href={permalinkDatosPersonales}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              tratamiento de mis datos personales
            </a>{" "}
            por parte de Wompi.
          </span>
        </label>
      </div>

      <form
        method="POST"
        action="/api/wompi/guardar-metodo-pago"
        onSubmitCapture={(e) => {
          if (!listoParaPagar) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="acceptance_token" value={acceptanceToken} />
        <input type="hidden" name="accept_personal_auth" value={acceptPersonalAuth} />
        <input type="hidden" name="session_id" value={sessionId} />
        <input type="hidden" name="device_id" value={deviceId} />

        {listoParaPagar ? (
          <div ref={contenedorBotonRef} />
        ) : (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-400"
          >
            Marca las dos casillas para continuar
          </button>
        )}
      </form>
    </>
  );
}
