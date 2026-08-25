"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Widget de agendamiento público de la landing — ver CLAUDE.md, sección
// "Formulario de agendamiento". Toda la lógica de horarios/Google Calendar
// vive del lado del servidor (src/lib/agendar.ts); acá solo se pinta lo que
// esas dos rutas devuelven y se maneja el estado de la UI.
//
// Diseño: panel dividido (calendario de mes a la izquierda, horas del día
// elegido a la derecha) — la opción que Andrés eligió de un set de 5
// mockups, con el fondo navy que también pidió como referencia.

type Fase =
  | "cargando"
  | "sin-horarios"
  | "eligiendo"
  | "enviando"
  | "confirmado"
  | "error";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const DOW_CORTO = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

const FORMATO_DIA_LARGO = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Bogota",
});
const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

function claveDia(iso: string): string {
  // Agrupa por día calendario en hora de Bogotá, no en la del navegador —
  // la reunión siempre se agenda en hora Colombia.
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).formatToParts(new Date(iso));
  const obtener = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return `${obtener("year")}-${obtener("month")}-${obtener("day")}`;
}

function capitalizarPrimera(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function claveCelda(anio: number, mes: number, dia: number): string {
  return `${anio}-${pad2(mes + 1)}-${pad2(dia)}`;
}

function claveMes(anio: number, mes: number): string {
  return `${anio}-${pad2(mes + 1)}`;
}

function celdasDelMes(anio: number, mes: number): (number | null)[] {
  const primerDia = new Date(anio, mes, 1).getDay();
  const totalDias = new Date(anio, mes + 1, 0).getDate();
  const celdas: (number | null)[] = new Array(primerDia).fill(null);
  for (let dia = 1; dia <= totalDias; dia++) celdas.push(dia);
  return celdas;
}

function sumarMes(
  m: { anio: number; mes: number },
  delta: number,
): { anio: number; mes: number } {
  let mes = m.mes + delta;
  let anio = m.anio;
  if (mes < 0) {
    mes = 11;
    anio -= 1;
  } else if (mes > 11) {
    mes = 0;
    anio += 1;
  }
  return { anio, mes };
}

export function AgendarWidget() {
  const [fase, setFase] = useState<Fase>("cargando");
  const [franjas, setFranjas] = useState<string[]>([]);
  const [mensajeError, setMensajeError] = useState("");
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  const [horarioElegido, setHorarioElegido] = useState<string | null>(null);
  const [mesActivo, setMesActivo] = useState({ anio: 2000, mes: 0 });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [enlaceEvento, setEnlaceEvento] = useState<string | null>(null);

  // Se computa una sola vez (el widget no vive abierto de un día para otro)
  // — marca la celda de "hoy" en el calendario, como en la referencia.
  const hoyClave = useMemo(() => claveDia(new Date().toISOString()), []);

  // El calendario manda: la lista de horas de al lado se topa a su mismo
  // alto (con scroll propio si un día tiene más franjas de las que
  // caben) en vez de al revés — sin esto, un día con muchas franjas
  // (16, por ejemplo) hacía crecer TODA la tarjeta para acomodarlas,
  // aunque el calendario ese mes solo necesitara 5 semanas. ResizeObserver
  // en vez de un simple listener de resize porque el alto del calendario
  // también cambia sin que cambie la ventana — al pasar de un mes de 5
  // semanas a uno de 6, por ejemplo.
  const calRef = useRef<HTMLDivElement>(null);
  const [alturaCal, setAlturaCal] = useState<number | null>(null);
  useEffect(() => {
    // [fase] a propósito, no []: .agendar-cal (y calRef) solo existen en
    // el DOM durante la fase "eligiendo" — con un efecto de una sola vez
    // en el montaje inicial, calRef.current todavía sería null (el
    // widget arranca en "cargando"), y el observer nunca se llegaría a
    // enganchar cuando el calendario apareciera después.
    const el = calRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const alto = entries[0]?.borderBoxSize?.[0]?.blockSize ?? entries[0]?.contentRect.height;
      if (alto) setAlturaCal(alto);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fase]);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/agendar/disponibilidad")
      .then((res) => res.json())
      .then((data: { franjas?: string[]; error?: string }) => {
        if (cancelado) return;
        if (data.error || !data.franjas || data.franjas.length === 0) {
          setFase("sin-horarios");
          return;
        }
        setFranjas(data.franjas);
        const primeraClave = claveDia(data.franjas[0]);
        setDiaElegido(primeraClave);
        const [anio, mes] = primeraClave.split("-").map(Number);
        setMesActivo({ anio, mes: mes - 1 });
        setFase("eligiendo");
      })
      .catch(() => {
        if (!cancelado) setFase("sin-horarios");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const dias = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const iso of franjas) {
      const clave = claveDia(iso);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(iso);
    }
    return Array.from(mapa.entries());
  }, [franjas]);

  const diasDisponibles = useMemo(
    () => new Set(dias.map(([clave]) => clave)),
    [dias],
  );
  const mesesDisponibles = useMemo(
    () => new Set(dias.map(([clave]) => clave.slice(0, 7))),
    [dias],
  );
  const celdas = useMemo(
    () => celdasDelMes(mesActivo.anio, mesActivo.mes),
    [mesActivo],
  );

  const mesAnterior = sumarMes(mesActivo, -1);
  const mesSiguiente = sumarMes(mesActivo, 1);
  const mesAnteriorHabilitado = mesesDisponibles.has(
    claveMes(mesAnterior.anio, mesAnterior.mes),
  );
  const mesSiguienteHabilitado = mesesDisponibles.has(
    claveMes(mesSiguiente.anio, mesSiguiente.mes),
  );

  const horariosDelDia = useMemo(() => {
    if (!diaElegido) return [];
    return dias.find(([clave]) => clave === diaElegido)?.[1] ?? [];
  }, [dias, diaElegido]);

  async function confirmar(datos: {
    nombre: string;
    correo: string;
    telefono: string;
    empresa: string;
    nota: string;
    trampa: string;
  }) {
    if (!horarioElegido) return;
    setFase("enviando");
    setMensajeError("");
    try {
      const res = await fetch("/api/agendar/reservar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, horarioISO: horarioElegido }),
      });
      const data: { ok?: true; link?: string | null; error?: string } =
        await res.json();
      if (data.error) {
        setMensajeError(data.error);
        setFase("eligiendo");
        return;
      }
      setEnlaceEvento(data.link ?? null);
      setFase("confirmado");
    } catch {
      setMensajeError("No se pudo agendar la reunión — intenta de nuevo.");
      setFase("eligiendo");
    }
  }

  if (fase === "cargando") {
    return <p className="agendar-estado">Buscando horarios disponibles…</p>;
  }

  if (fase === "sin-horarios") {
    return (
      <div className="agendar-estado">
        <p>Por ahora no podemos mostrarte horarios disponibles.</p>
        <a
          className="btn"
          href="mailto:andresp7070@gmail.com?subject=Quiero%20agendar%20una%20reuni%C3%B3n%20con%20Datum"
        >
          Escríbenos directamente
        </a>
      </div>
    );
  }

  if (fase === "confirmado") {
    return (
      <div className="agendar-confirmado">
        <p className="agendar-confirmado-titulo">
          ¡Listo! Tu reunión quedó agendada.
        </p>
        <p>
          Te llegará la invitación a tu correo, con el link para la
          videollamada.
        </p>
        {enlaceEvento && (
          <a
            className="agendar-link-evento"
            href={enlaceEvento}
            target="_blank"
            rel="noreferrer"
          >
            Ver evento en Google Calendar
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="agendar-widget">
      {!mostrarForm && (
        <>
          <p className="agendar-paso">
            Elige un día y una hora{" "}
            <span className="agendar-nota-zona">(hora de Colombia)</span>
          </p>
          <div className="agendar-split">
            <div className="agendar-cal" ref={calRef}>
              <div className="agendar-cal-cab">
                <button
                  type="button"
                  className="agendar-cal-nav"
                  onClick={() => setMesActivo(mesAnterior)}
                  disabled={!mesAnteriorHabilitado}
                  aria-label="Mes anterior"
                >
                  ‹
                </button>
                <span className="agendar-cal-mes">
                  {MESES[mesActivo.mes]} {mesActivo.anio}
                </span>
                <button
                  type="button"
                  className="agendar-cal-nav"
                  onClick={() => setMesActivo(mesSiguiente)}
                  disabled={!mesSiguienteHabilitado}
                  aria-label="Mes siguiente"
                >
                  ›
                </button>
              </div>
              <div className="agendar-cal-grid">
                {DOW_CORTO.map((d) => (
                  <span key={d} className="agendar-cal-dow">
                    {d}
                  </span>
                ))}
                {celdas.map((dia, i) => {
                  if (dia === null)
                    return (
                      <span key={`v${i}`} className="agendar-cal-dia vacio" />
                    );
                  const clave = claveCelda(mesActivo.anio, mesActivo.mes, dia);
                  const disponible = diasDisponibles.has(clave);
                  return (
                    <button
                      key={clave}
                      type="button"
                      className={
                        "agendar-cal-dia" +
                        (disponible ? " disponible" : "") +
                        (clave === hoyClave ? " hoy" : "") +
                        (clave === diaElegido ? " activo" : "")
                      }
                      disabled={!disponible}
                      onClick={() => {
                        setDiaElegido(clave);
                        setHorarioElegido(null);
                      }}
                    >
                      {dia}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="agendar-horas-col"
              style={alturaCal ? { maxHeight: alturaCal } : undefined}
            >
              {horariosDelDia.length > 0 && (
                <p className="agendar-horas-fecha">
                  {capitalizarPrimera(
                    FORMATO_DIA_LARGO.format(new Date(horariosDelDia[0])),
                  )}
                </p>
              )}
              <div className="agendar-horas-lista">
                {horariosDelDia.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    className={
                      "agendar-hora" + (iso === horarioElegido ? " activo" : "")
                    }
                    onClick={() => setHorarioElegido(iso)}
                  >
                    {FORMATO_HORA.format(new Date(iso))}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="agendar-resumen-bar">
            <p className="agendar-resumen-texto">
              {horarioElegido ? (
                <>
                  Tu reunión sería el{" "}
                  <strong>
                    {capitalizarPrimera(
                      FORMATO_DIA_LARGO.format(new Date(horarioElegido)),
                    )}
                  </strong>{" "}
                  a las{" "}
                  <strong className="agendar-hora-inline">
                    {FORMATO_HORA.format(new Date(horarioElegido))}
                  </strong>
                </>
              ) : (
                "Elige un día y un horario para continuar."
              )}
            </p>
            <button
              type="button"
              className="agendar-btn-continuar"
              disabled={!horarioElegido}
              onClick={() => setMostrarForm(true)}
            >
              Continuar
            </button>
          </div>
        </>
      )}

      {mostrarForm && horarioElegido && (
        <div className="agendar-paso3">
          <button
            type="button"
            className="agendar-volver"
            onClick={() => setMostrarForm(false)}
          >
            ← Cambiar horario
          </button>
          <p className="agendar-resumen">
            {capitalizarPrimera(
              FORMATO_DIA_LARGO.format(new Date(horarioElegido)),
            )}{" "}
            ·{" "}
            <span className="agendar-hora-inline">
              {FORMATO_HORA.format(new Date(horarioElegido))}
            </span>
          </p>
          <FormularioDatos
            disabled={fase === "enviando"}
            error={mensajeError}
            onConfirmar={confirmar}
          />
        </div>
      )}
    </div>
  );
}

function FormularioDatos({
  disabled,
  error,
  onConfirmar,
}: {
  disabled: boolean;
  error: string;
  onConfirmar: (datos: {
    nombre: string;
    correo: string;
    telefono: string;
    empresa: string;
    nota: string;
    trampa: string;
  }) => void;
}) {
  return (
    <form
      className="agendar-form"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        onConfirmar({
          nombre: String(form.get("nombre") ?? ""),
          correo: String(form.get("correo") ?? ""),
          telefono: String(form.get("telefono") ?? ""),
          empresa: String(form.get("empresa") ?? ""),
          nota: String(form.get("nota") ?? ""),
          trampa: String(form.get("sitio_web") ?? ""),
        });
      }}
    >
      <div className="agendar-form-fila">
        <input
          name="nombre"
          type="text"
          placeholder="Nombre *"
          required
          disabled={disabled}
        />
        <input
          name="telefono"
          type="tel"
          placeholder="Teléfono *"
          required
          disabled={disabled}
        />
      </div>
      <input
        name="correo"
        type="email"
        placeholder="Correo *"
        required
        disabled={disabled}
      />
      <input
        name="empresa"
        type="text"
        placeholder="Empresa *"
        required
        disabled={disabled}
      />
      <textarea
        name="nota"
        placeholder="Cuéntanos qué te gustaría ver de Datum (Opcional)"
        rows={3}
        disabled={disabled}
      />
      {/* Campo trampa: oculto para una persona real, los bots suelen llenar todo. */}
      <input
        name="sitio_web"
        type="text"
        className="agendar-honeypot"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      {error && <p className="agendar-form-error">{error}</p>}
      <button
        type="submit"
        className="agendar-btn-confirmar"
        disabled={disabled}
      >
        {disabled ? "Agendando…" : "Confirmar reunión"}
      </button>
    </form>
  );
}
