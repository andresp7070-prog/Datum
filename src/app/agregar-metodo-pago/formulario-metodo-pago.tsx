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
  // ancestro más cercano — con un <div> de por medio, ese padre inmediato
  // es el div (sin .method ni .action), no el form, aunque el form en sí
  // esté perfectamente bien formado. Por eso el error de "method debe ser
  // POST" seguía igual incluso después de corregir el orden de esos
  // atributos en el form.
  useEffect(() => {
    if (!listoParaPagar || !formRef.current) return;
    const form = formRef.current;
    // Marcador invisible (no es un elemento, no interfiere con que Wompi
    // encuentre el <form>) para poder borrar TODO lo que se agregue de acá
    // en adelante, sin importar qué estructura use el widget por dentro.
    const marcador = document.createComment("widget-wompi");
    form.appendChild(marcador);
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
    form.appendChild(script);
    return () => {
      // No basta con quitar el <script>: para cuando se ejecuta, el widget
      // ya insertó su propio botón como otro hijo del form, y quitar solo
      // el <script> no deshace eso. Sin este barrido completo (todo lo que
      // quedó después del marcador), desmarcar y volver a marcar las
      // casillas dejaba un botón de Wompi nuevo cada vez, sin quitar el
      // anterior.
      let nodo = marcador.nextSibling;
      while (nodo) {
        const siguiente = nodo.nextSibling;
        nodo.remove();
        nodo = siguiente;
      }
      marcador.remove();
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
        ref={formRef}
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

        {/* El botón real de Wompi se inserta acá como hijo directo del
            form, por fuera de React (ver el useEffect de arriba) — mientras
            tanto, este botón deshabilitado ocupa su lugar visualmente. */}
        {!listoParaPagar && (
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
