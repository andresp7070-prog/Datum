"use client";

import { useEffect, useRef, useState } from "react";
import "./landing.css";
import { EcosistemaDemo } from "./ecosistema-demo";

type Plan = {
  nombre: string;
  mensual: number;
  descripcion: string;
  destacado: boolean;
  feats: string[];
};

const PLANES: Plan[] = [
  {
    nombre: "Startup",
    mensual: 99900,
    descripcion: "Para empezar con lo esencial.",
    destacado: false,
    feats: ["1 a 2 módulos de tu elección", "Panel de control"],
  },
  {
    nombre: "Pyme",
    mensual: 199900,
    descripcion: "Para crecer con más control.",
    destacado: true,
    feats: ["3 a 4 módulos de tu elección", "Panel de control"],
  },
  {
    nombre: "Enterprise",
    mensual: 349900,
    descripcion: "Para llevarlo al siguiente nivel.",
    destacado: false,
    feats: ["Todos los módulos", "Panel de control", "Insights"],
  },
];

const DESCUENTO_ANUAL = 0.2;

function formatoCOP(valor: number) {
  return "$" + Math.round(valor).toLocaleString("es-CO");
}

function IconoCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const needleRef = useRef<SVGGElement>(null);
  const dialogNosotrosRef = useRef<HTMLDialogElement>(null);
  const dialogTerminosRef = useRef<HTMLDialogElement>(null);
  const dialogPrivacidadRef = useRef<HTMLDialogElement>(null);

  const [billing, setBilling] = useState<"mensual" | "anual">("mensual");
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Switch momentáneo para revisar la versión móvil sin cambiar de
  // dispositivo — muestra la misma página dentro de un iframe angosto,
  // así sí disparan los media queries reales (a diferencia de solo
  // achicar un contenedor). Quitar cuando ya no haga falta revisar esto.
  const [vistaMovil, setVistaMovil] = useState(false);
  const esAnual = billing === "anual";

  // El propio marco de vista previa carga esta misma página en un iframe —
  // ahí no debe mostrarse el botón de nuevo, se vería encima del menú.
  const viewportToggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (window.self !== window.top && viewportToggleRef.current) {
      viewportToggleRef.current.style.display = "none";
    }
  }, []);

  // Revela cada sección con un fade + slide sutil cuando entra en pantalla.
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll(".reveal");
    if (!els || els.length === 0) return;

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 },
      );
      els.forEach((el) => io.observe(el));
      return () => io.disconnect();
    }

    els.forEach((el) => el.classList.add("in"));
  }, []);

  // La brújula del hero sigue el cursor. Ángulo acumulado (sin normalizar a
  // -180/180) para que nunca dé un giro completo raro al cruzar por detrás
  // del centro — siempre gira por el camino más corto.
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const needle = needleRef.current;
    const heroEl = heroRef.current;
    if (!needle || !heroEl || reduceMotion) return;

    let ticking = false;
    let lastX = 0;
    let lastY = 0;
    let currentRotation = 0;

    function shortestDelta(d: number) {
      return ((d % 360) + 540) % 360 - 180;
    }

    function updateNeedle() {
      const rect = heroEl!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const target = Math.atan2(lastY - cy, lastX - cx) * (180 / Math.PI) + 90;
      currentRotation += shortestDelta(target - currentRotation);
      needle!.style.transform = `rotate(${currentRotation}deg)`;
      ticking = false;
    }

    function onMouseMove(e: MouseEvent) {
      lastX = e.clientX;
      lastY = e.clientY;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateNeedle);
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  if (vistaMovil) {
    return (
      <div className="mobile-preview-wrap">
        <button type="button" className="viewport-toggle" onClick={() => setVistaMovil(false)}>
          Ver escritorio
        </button>
        <div className="mobile-preview-frame">
          <iframe src="/" title="Vista previa móvil" />
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <button
        type="button"
        ref={viewportToggleRef}
        className="viewport-toggle"
        onClick={() => setVistaMovil(true)}
      >
        Ver móvil
      </button>
      <nav className="top">
        <div className="wrap">
          <div className="brand">
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path
                d="M 24 42 A 18 18 0 1 1 36.321 37.122"
                stroke="currentColor"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <path d="M24 10 L29 24 L24 38 L19 24 Z" fill="currentColor" />
            </svg>
            Datum
          </div>
          <div className="nav-actions">
            <div className={`nav-links${menuAbierto ? " is-open" : ""}`}>
              <a href="#ecosistema" onClick={() => setMenuAbierto(false)}>
                Ecosistema
              </a>
              <a href="#precios" onClick={() => setMenuAbierto(false)}>
                Precios
              </a>
              <a href="#contacto" onClick={() => setMenuAbierto(false)}>
                Contacto
              </a>
            </div>
            <a href="/login" className="nav-login">
              Iniciar sesión
            </a>
            <button
              type="button"
              className="nav-burger"
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto((v) => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                {menuAbierto ? (
                  <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <header className="hero" id="hero" ref={heroRef}>
        <svg className="hero-motif" viewBox="0 0 200 200" fill="none" aria-hidden="true">
          <path
            className="ring"
            d="M100 175 A75 75 0 1 1 151.34 154.68"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <g className="needle" ref={needleRef}>
            <path className="head-left" d="M100 42 L100 100 L79 100 Z" fill="currentColor" stroke="none" />
            <path className="head-right" d="M100 42 L121 100 L100 100 Z" fill="currentColor" stroke="none" />
            <line className="head-ridge" x1="100" y1="42" x2="100" y2="100" stroke="currentColor" strokeWidth="0.6" />
            <path className="tail" d="M79 100 L100 158 L121 100" stroke="currentColor" strokeWidth="0.5" />
            <line className="tail-ridge" x1="100" y1="100" x2="100" y2="158" stroke="currentColor" strokeWidth="0.5" />
          </g>
        </svg>
        <h1>Todo lo que necesita tu empresa en un solo lugar</h1>
        <p className="lede">
          Creamos un ecosistema a medida con las soluciones tecnológicas que impulsan el
          crecimiento de tu empresa.
        </p>
        <a className="more" href="#ecosistema" aria-label="Ver más abajo">
          <svg viewBox="0 0 12 12" fill="none">
            <path
              d="M6 2v8M2.5 7 6 10.5 9.5 7"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </header>

      <section className="chapter chapter-oscuro reveal" id="ecosistema">
        <div className="wrap">
          <div className="chapter-head">
            <h2>Nuestro ecosistema</h2>
            <p className="subtitle">
              Cada módulo está conectado e interactúa con los demás, toda la gestión a un solo clic.
            </p>
          </div>
          <EcosistemaDemo />
          <div className="chapter-cta">
            <a
              className="btn"
              href="mailto:andresp7070@gmail.com?subject=Quiero%20mi%20prueba%20gratis%20de%2030%20d%C3%ADas%20con%20Datum"
            >
              Solicita tu prueba gratis de 30 días
            </a>
          </div>
        </div>
      </section>

      <section className="chapter alt chapter-pasos reveal" id="como-funciona">
        <div className="wrap">
          <div className="chapter-head">
            <p className="tag-label">Cómo funciona</p>
            <h2>Empieza en días, no en meses</h2>
          </div>
          <div className="pasos-grid">
            <div className="paso">
              <span className="paso-num">01</span>
              <h3>Conecta tu negocio</h3>
              <p>Sube tus productos, registra a tu equipo y activa los módulos que tu negocio necesita.</p>
            </div>
            <div className="paso">
              <span className="paso-num">02</span>
              <h3>Registra el día a día</h3>
              <p>Cada venta, cada cliente, cada movimiento de inventario registrado en un solo lugar.</p>
            </div>
            <div className="paso">
              <span className="paso-num">03</span>
              <h3>Decide con datos</h3>
              <p>Conoce qué pasó, qué viene y qué te conviene hacer con datos en tiempo real.</p>
            </div>
          </div>
          <div className="chapter-cta">
            <a
              className="btn"
              href="mailto:andresp7070@gmail.com?subject=Quiero%20mi%20prueba%20gratis%20de%2030%20d%C3%ADas%20con%20Datum"
            >
              Solicita tu prueba gratis de 30 días
            </a>
          </div>
        </div>
      </section>

      <section className="chapter chapter-oscuro reveal" id="precios">
        <div className="wrap">
          <div className="chapter-head">
            <h2>Nos adaptamos a lo que necesitas</h2>
            <p className="subtitle">Elige tu plan.</p>
          </div>

          <div className="billing-toggle-wrap">
            <div className="billing-toggle" role="group" aria-label="Frecuencia de pago">
              <button
                type="button"
                className={`billing-btn${!esAnual ? " is-active" : ""}`}
                onClick={() => setBilling("mensual")}
              >
                Mensual
              </button>
              <button
                type="button"
                className={`billing-btn${esAnual ? " is-active" : ""}`}
                onClick={() => setBilling("anual")}
              >
                Anual <span className="off-badge">-20% OFF</span>
              </button>
            </div>
          </div>

          <div className="precios-table">
            {PLANES.map((plan) => {
              const totalSinDescuento = plan.mensual * 12;
              const totalConDescuento = totalSinDescuento * (1 - DESCUENTO_ANUAL);
              const ahorro = totalSinDescuento - totalConDescuento;

              return (
                <div key={plan.nombre} className={`plan${plan.destacado ? " destacado" : ""}`}>
                  {plan.destacado && (
                    <span className="plan-flag">
                      Recomendado
                      <span aria-hidden="true">🔥</span>
                    </span>
                  )}
                  <span className="plan-name">{plan.nombre}</span>
                  <div className={`plan-price${esAnual ? " es-anual" : ""}`}>
                    <span className="full" hidden={!esAnual}>
                      {formatoCOP(totalSinDescuento)}
                    </span>
                    <span className="num">{formatoCOP(esAnual ? totalConDescuento : plan.mensual)}</span>
                    <span className="per">{esAnual ? "COP / año" : "COP / mes"}</span>
                  </div>
                  <p className="plan-save" hidden={!esAnual}>
                    Ahorras {formatoCOP(ahorro)} al año
                  </p>
                  <p className="plan-desc">{plan.descripcion}</p>
                  <ul className="plan-feats">
                    {plan.feats.map((feat) => (
                      <li key={feat}>
                        <IconoCheck />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="precios-cta-row">
            {PLANES.map((plan) => (
              <a
                key={plan.nombre}
                className="precios-cta"
                href={`mailto:andresp7070@gmail.com?subject=${encodeURIComponent(
                  `Quiero mi prueba gratis de 30 días — Plan ${plan.nombre}`,
                )}`}
              >
                Solicita tu prueba gratis de 30 días
              </a>
            ))}
          </div>
        </div>
      </section>

      <dialog
        className="legal-dialog"
        ref={dialogNosotrosRef}
        onClick={(e) => {
          if (e.target === dialogNosotrosRef.current) dialogNosotrosRef.current?.close();
        }}
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Cerrar"
          onClick={() => dialogNosotrosRef.current?.close()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
          </svg>
        </button>
        <div className="nosotros-layout">
          <div className="nosotros-avatar" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <path
                d="M 24 42 A 18 18 0 1 1 36.321 37.122"
                stroke="currentColor"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <path d="M24 10 L29 24 L24 38 L19 24 Z" fill="currentColor" />
            </svg>
          </div>
          <div className="nosotros-text">
            <p className="tag-label">Nosotros</p>
            <h2>Un ecosistema hecho por alguien que cree en las empresas pequeñas</h2>
            <p>
              Fundador de Datum. Después de ver de cerca cuánto tiempo y dinero pierden los
              negocios por no tener sus datos en un solo lugar, decidí construir la herramienta
              que a mí me hubiera gustado tener: un punto de partida claro, hecho a la medida de
              cada negocio, para que cualquier empresa pueda crecer sin necesitar su propio
              equipo de tecnología.
            </p>
          </div>
        </div>
      </dialog>

      <section className="chapter alt cta-final statement reveal" id="contacto">
        <div className="wrap">
          <h2>Hablemos de tu negocio</h2>
          <p className="sub">
            Agendemos una conversación de 20 minutos sin costo, y descubre todo lo que Datum
            puede hacer por tu negocio.
          </p>
          <a
            className="btn"
            href="mailto:andresp7070@gmail.com?subject=Quiero%20agendar%20una%20conversaci%C3%B3n%20con%20Datum"
          >
            Agendar ahora
          </a>
        </div>
      </section>

      <dialog
        className="legal-dialog"
        ref={dialogTerminosRef}
        onClick={(e) => {
          if (e.target === dialogTerminosRef.current) dialogTerminosRef.current?.close();
        }}
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Cerrar"
          onClick={() => dialogTerminosRef.current?.close()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
          </svg>
        </button>
        <div className="legal-section">
          <h2>Términos y condiciones</h2>
          <p className="legal-updated">Última actualización: enero de 2026</p>

          <h3>1. Aceptación de los términos</h3>
          <p>
            Al crear una cuenta o usar la plataforma Datum, aceptas estos términos y condiciones
            en su totalidad. Si no estás de acuerdo con alguno de ellos, no debes usar el
            servicio.
          </p>

          <h3>2. Descripción del servicio</h3>
          <p>
            Datum es una plataforma de gestión para empresas que incluye, según el plan
            contratado, módulos de ventas, CRM, inventario, estado de resultados, nómina y
            paneles de control, entre otros. Nos reservamos el derecho de agregar, modificar o
            retirar funcionalidades para mejorar el servicio.
          </p>

          <h3>3. Cuenta y responsabilidad del usuario</h3>
          <p>
            Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de
            toda la actividad que ocurra dentro de tu cuenta. Debes notificarnos de inmediato
            ante cualquier uso no autorizado.
          </p>

          <h3>4. Planes, pagos y facturación</h3>
          <p>
            El acceso a Datum se ofrece mediante suscripción mensual o anual, según el plan
            elegido. Los precios pueden ajustarse con previo aviso razonable. La cancelación no
            genera reembolsos por periodos ya facturados, salvo que la ley aplicable indique lo
            contrario.
          </p>

          <h3>5. Propiedad intelectual</h3>
          <p>
            El software, el diseño y la marca Datum son propiedad de sus creadores. Los datos
            que ingreses a la plataforma (ventas, clientes, inventario, etc.) siguen siendo tuyos
            en todo momento.
          </p>

          <h3>6. Limitación de responsabilidad</h3>
          <p>
            Datum se ofrece &ldquo;tal cual&rdquo;. Hacemos lo posible por mantener el servicio
            disponible y seguro, pero no garantizamos que esté libre de interrupciones o
            errores, y no somos responsables por decisiones de negocio tomadas con base en la
            información de la plataforma.
          </p>

          <h3>7. Cambios a estos términos</h3>
          <p>
            Podemos actualizar estos términos ocasionalmente. Te notificaremos de cambios
            importantes antes de que entren en vigencia.
          </p>

          <h3>8. Ley aplicable</h3>
          <p>Estos términos se rigen por las leyes de la República de Colombia.</p>

          <h3>9. Contacto</h3>
          <p>
            Para preguntas sobre estos términos, escríbenos a{" "}
            <a href="mailto:andresp7070@gmail.com">andresp7070@gmail.com</a>.
          </p>
        </div>
      </dialog>

      <dialog
        className="legal-dialog"
        ref={dialogPrivacidadRef}
        onClick={(e) => {
          if (e.target === dialogPrivacidadRef.current) dialogPrivacidadRef.current?.close();
        }}
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Cerrar"
          onClick={() => dialogPrivacidadRef.current?.close()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
          </svg>
        </button>
        <div className="legal-section">
          <h2>Política de privacidad</h2>
          <p className="legal-updated">Última actualización: enero de 2026</p>

          <h3>1. Qué datos recopilamos</h3>
          <p>
            Recopilamos la información que nos das al crear tu cuenta (nombre, correo, datos de
            tu empresa) y la que registras al usar la plataforma (ventas, clientes, inventario, y
            demás datos propios de tu negocio).
          </p>

          <h3>2. Cómo usamos tus datos</h3>
          <p>
            Usamos tus datos únicamente para prestarte el servicio: mostrarte tu información,
            generar tus reportes y mantener tu cuenta funcionando. No usamos tus datos de negocio
            para entrenar modelos ni para ningún fin distinto al de operar la plataforma.
          </p>

          <h3>3. Con quién compartimos tus datos</h3>
          <p>
            No vendemos ni compartimos tu información con terceros, salvo con proveedores
            necesarios para operar el servicio (por ejemplo, hosting o envío de correos) o
            cuando la ley nos obligue a hacerlo.
          </p>

          <h3>4. Seguridad de la información</h3>
          <p>
            Cada empresa solo puede ver sus propios datos dentro de la plataforma. Aplicamos
            medidas técnicas razonables para proteger tu información contra accesos no
            autorizados.
          </p>

          <h3>5. Tus derechos</h3>
          <p>
            De acuerdo con la Ley 1581 de 2012 de Colombia (Habeas Data), tienes derecho a
            conocer, actualizar, rectificar y solicitar la eliminación de tus datos personales.
            Puedes ejercer estos derechos escribiéndonos directamente.
          </p>

          <h3>6. Cambios a esta política</h3>
          <p>
            Podemos actualizar esta política ocasionalmente. Te notificaremos de cambios
            importantes antes de que entren en vigencia.
          </p>

          <h3>7. Contacto</h3>
          <p>
            Para preguntas sobre esta política o para ejercer tus derechos, escríbenos a{" "}
            <a href="mailto:andresp7070@gmail.com">andresp7070@gmail.com</a>.
          </p>
        </div>
      </dialog>

      <footer>
        <div className="wrap footer-top">
          <div className="footer-brand">
            <div className="brand">
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path
                  d="M 24 42 A 18 18 0 1 1 36.321 37.122"
                  stroke="currentColor"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                />
                <path d="M24 10 L29 24 L24 38 L19 24 Z" fill="currentColor" />
              </svg>
              Datum
            </div>
            <p>Ecosistema de gestión para empresas de todos los tamaños.</p>
            <div className="footer-social">
              <a href="#" aria-label="LinkedIn de Datum">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M8 11v5M8 8v.01M12 16v-3.2c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8V16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram de Datum">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.2" cy="6.8" r="0.7" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a href="#" aria-label="Facebook de Datum">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M14 8.2h-1.3A1.7 1.7 0 0 0 11 9.9V12M9 12h5M12.5 12v6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a href="#" aria-label="TikTok de Datum">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M13.5 3.5v11.2a3.3 3.3 0 1 1-3.3-3.3c.3 0 .6.03.9.1" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.5 3.5c.3 2.3 1.9 4 4.2 4.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>

          <div className="footer-col">
            <p className="footer-heading">Producto</p>
            <a href="#ecosistema">Ecosistema</a>
            <a href="#precios">Precios</a>
            <a href="#contacto">Contacto</a>
          </div>

          <div className="footer-col">
            <p className="footer-heading">Empresa</p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                dialogNosotrosRef.current?.showModal();
              }}
            >
              Nosotros
            </a>
            <a href="mailto:andresp7070@gmail.com">Escríbenos</a>
          </div>

          <div className="footer-col">
            <p className="footer-heading">Legal</p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                dialogTerminosRef.current?.showModal();
              }}
            >
              Términos y condiciones
            </a>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                dialogPrivacidadRef.current?.showModal();
              }}
            >
              Política de privacidad
            </a>
          </div>
        </div>

        <div className="wrap footer-bottom">
          <p>© 2026 Datum. Todos los derechos reservados.</p>
          <p>Hecho en Colombia</p>
        </div>
      </footer>
    </div>
  );
}
