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
  const [widgetMontado, setWidgetMontado] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const listoParaPagar = aceptaTerminos && aceptaDatos;

  // React reordena el atributo "action" de un <form> al renderizarlo (por
  // su manejo especial de formularios) — el HTML final termina con
  // action antes que method, aunque acá se escriban al revés. El
  // validador de Wompi revisa el orden literal de los atributos y exige
  // que method vaya primero, igual que en su propio ejemplo — se fuerza
  // a mano quitando y volviendo a poner los atributos en ese orden.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const accion = form.getAttribute("action");
    form.removeAttribute("method");
    form.removeAttribute("action");
    form.setAttribute("method", "POST");
    if (accion) form.setAttribute("action", accion);
  }, []);

  // El botón real de Wompi (el que de verdad tokeniza la tarjeta) solo se
  // agrega al DOM una vez las dos casillas están marcadas — así no hay
  // forma de llegar a escribir la tarjeta sin haber aceptado antes los
  // términos de Wompi, como exige su documentación de "Tokens de
  // aceptación". Se agrega con un <script> creado a mano (no vía JSX)
  // porque los navegadores solo ejecutan un <script src> insertado así,
  // no uno puesto con innerHTML.
  //
  // El script se agrega como HIJO DIRECTO del <form> (formRef.current),
  // nunca dentro de un <div> intermedio: en el ejemplo real de Wompi el
  // script es hijo directo del formulario, y su validador probablemente
  // ubica el formulario mirando el padre inmediato del script, no el
  // ancestro más cercano.
  //
  // Se monta UNA SOLA VEZ (guardado con widgetMontado) y nunca se vuelve a
  // quitar, aunque después se desmarque una casilla. Insertarlo y quitarlo
  // cada vez que cambiaban las casillas causaba dos problemas: el widget de
  // Wompi quedaba en un estado roto al recargarse varias veces seguidas
  // (error propio "Cannot read properties of null"), y sobre todo, React
  // deja de llevar la cuenta correcta de los hijos del <form> en cuanto algo
  // externo los mueve — chocaba con el botón de "Marca las dos casillas"
  // (que antes se agregaba/quitaba con React) y terminaba en un
  // "NotFoundError: removeChild" que dañaba toda la pantalla. Por eso el
  // botón de placeholder de abajo ahora tampoco se quita del DOM: solo se
  // oculta con el atributo hidden, así React jamás vuelve a tocar los hijos
  // del formulario después del primer render.
  useEffect(() => {
    if (!listoParaPagar || widgetMontado || !formRef.current) return;
    const script = document.createElement("script");
    // Un <script> creado así se ejecuta "async" por defecto — el widget de
    // Wompi probablemente se apoya en document.currentScript para leer sus
    // propios atributos data-*, y eso solo funciona confiablemente si el
    // script corre en orden (no async). Sin esto, el script podía cargar
    // sin error y aun así no dibujar nada.
    script.async = false;
    script.src = "https://checkout.wompi.co/widget.js";
    script.setAttribute("data-render", "button");
    script.setAttribute("data-widget-operation", "tokenize");
    script.setAttribute("data-public-key", llavePublica);
    formRef.current.appendChild(script);
    setWidgetMontado(true);
  }, [listoParaPagar, widgetMontado, llavePublica]);

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

      {/* El widget de Wompi, una vez montado, nunca se vuelve a quitar del
          DOM (ver el useEffect de arriba) — así que ocultarlo cuando se
          desmarca una casilla no puede hacerse quitándolo, tiene que ser
          con CSS. Esta regla oculta cualquier cosa que haya quedado
          después del <script> del widget (sea botón, iframe, lo que sea
          que dibuje) mientras el formulario no esté "listo". */}
      <style>{`
        form[data-listo="false"] script[data-widget-operation="tokenize"] ~ * {
          display: none !important;
        }
      `}</style>

      <form
        ref={formRef}
        method="POST"
        action="/api/wompi/guardar-metodo-pago"
        data-listo={listoParaPagar ? "true" : "false"}
        className="flex flex-col items-center"
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

        {/* El botón real de Wompi se inserta como hijo directo del form,
            por fuera de React (ver el useEffect de arriba) — mientras
            tanto, y cada vez que se desmarca una casilla, este botón
            deshabilitado ocupa su lugar visualmente. Se oculta con
            "hidden" en vez de dejar de renderizarse: así React nunca
            quita ni vuelve a insertar este nodo, que es justo lo que antes
            chocaba con el <script> agregado a mano. */}
        <button
          type="button"
          disabled
          hidden={listoParaPagar}
          className="w-full cursor-not-allowed rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-400"
        >
          Marca las dos casillas para continuar
        </button>
      </form>
    </>
  );
}
