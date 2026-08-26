"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./landing.css";
import { EcosistemaDemo } from "./ecosistema-demo";
import { AgendarWidget } from "./agendar-widget";

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

const DESCUENTO_ANUAL = 0.15;

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
  const esferaRef = useRef<HTMLDivElement>(null);
  const orbitaRef = useRef<HTMLDivElement>(null);
  const compasWrapRef = useRef<HTMLDivElement>(null);
  const compasZoomRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const progresoScrollRef = useRef<HTMLDivElement>(null);
  const heroTextoRef = useRef<HTMLDivElement>(null);
  const dialogNosotrosRef = useRef<HTMLDialogElement>(null);
  const dialogTerminosRef = useRef<HTMLDialogElement>(null);
  const dialogPrivacidadRef = useRef<HTMLDialogElement>(null);
  const dialogAgendaRef = useRef<HTMLDialogElement>(null);

  const [billing, setBilling] = useState<"mensual" | "anual">("mensual");
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Qué botón abrió el pop-up de agendamiento ("Ecosistema", "Cómo
  // funciona", "Plan Pyme", etc.) — viaja como AgendarWidget.origen y
  // queda guardado en datum_leads.origen, para saber qué le interesaba a
  // la persona sin tener que preguntárselo en el formulario. null =
  // pop-up cerrado; se usa también para que AgendarWidget se desmonte y
  // vuelva a arrancar en blanco cada vez que se abre (key={popupOrigen}
  // más abajo), en vez de conservar el día/hora ya elegidos de una
  // apertura anterior.
  const [popupOrigen, setPopupOrigen] = useState<string | null>(null);
  useEffect(() => {
    if (popupOrigen) dialogAgendaRef.current?.showModal();
  }, [popupOrigen]);
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

  // Todo el comportamiento del hero: la brújula sigue el cursor con física
  // de resorte real (no un simple promedio), la esfera de puntos (CSS 3D,
  // sin WebGL) con pulsos eléctricos dorados viajando entre nodos, el
  // paralaje del cursor, y la barra de progreso arriba de toda la página
  // (lectura del scroll de toda la página, no solo del hero). El hero ya
  // no tiene ningún mecanismo de scroll propio — es una sección estática,
  // el scroll de acá para abajo es 100% nativo del navegador.
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const needle = needleRef.current;
    const esfera = esferaRef.current;
    const orbita = orbitaRef.current;
    const compasWrap = compasWrapRef.current;
    const compasZoom = compasZoomRef.current;
    const h1 = h1Ref.current;
    const progresoScrollEl = progresoScrollRef.current;
    const heroTexto = heroTextoRef.current;
    if (
      !needle || !esfera || !orbita || !compasWrap || !compasZoom || !h1 ||
      !progresoScrollEl || !heroTexto
    ) {
      return;
    }

    function shortestDelta(d: number) {
      return ((d % 360) + 540) % 360 - 180;
    }

    // ---- esfera de puntos (Fibonacci sphere) con líneas a los 3 vecinos
    // más próximos de cada nodo — la del hero, con pulsos de luz y ligada
    // al scroll. ----
    type Punto3 = { x: number; y: number; z: number };
    function distancia3(a: Punto3, b: Punto3) {
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    function crearEsferaPuntos(contenedor: HTMLElement, n: number, radio: number) {
      const golden = Math.PI * (3 - Math.sqrt(5));
      const puntos: Punto3[] = [];
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i;
        puntos.push({ x: Math.cos(theta) * r * radio, y: y * radio, z: Math.sin(theta) * r * radio });
        const div = document.createElement("div");
        div.className = "punto";
        div.style.transform = `translate3d(${puntos[i].x.toFixed(1)}px,${puntos[i].y.toFixed(1)}px,${puntos[i].z.toFixed(1)}px)`;
        contenedor.appendChild(div);
      }
      const paresLista: { a: Punto3; b: Punto3 }[] = [];
      function agregarLinea(a: Punto3, b: Punto3) {
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const largo = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (largo < 0.01) return;
        const rotY = (-Math.atan2(dz, dx) * 180) / Math.PI;
        const rotZ = (Math.asin(dy / largo) * 180) / Math.PI;
        const linea = document.createElement("div");
        linea.className = "linea";
        linea.style.width = `${largo.toFixed(1)}px`;
        linea.style.transform = `translate3d(${a.x.toFixed(1)}px,${a.y.toFixed(1)}px,${a.z.toFixed(1)}px) rotateY(${rotY.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg)`;
        contenedor.insertBefore(linea, contenedor.firstChild);
        paresLista.push({ a, b });
      }
      // Cada punto elige a sus 3 vecinos más cercanos, pero esa elección casi
      // siempre es mutua (B también elige a A) — sin este control, esa misma
      // línea se dibujaba dos veces una encima de la otra, y se veía más
      // gruesa/brillante que el resto. `vistos` se asegura de dibujar cada
      // conexión una sola vez, sin importar quién la haya elegido primero.
      const vistos = new Set<string>();
      for (let j = 0; j < puntos.length; j++) {
        const distancias = puntos
          .map((p, k) => ({ k, d: k === j ? Infinity : distancia3(puntos[j], p) }))
          .sort((a, b) => a.d - b.d);
        for (let m = 0; m < 3; m++) {
          const k = distancias[m].k;
          const clave = j < k ? `${j}-${k}` : `${k}-${j}`;
          if (vistos.has(clave)) continue;
          vistos.add(clave);
          agregarLinea(puntos[j], puntos[k]);
        }
      }
      return paresLista;
    }
    const paresLista = crearEsferaPuntos(esfera, 72, 200);

    type Pulso = { el: HTMLDivElement; activo: boolean; inicioT: number; duracion: number; par: { a: Punto3; b: Punto3 } | null; espera: number };
    const pulsos: Pulso[] = [];
    if (!reduceMotion && paresLista.length) {
      for (let pi = 0; pi < 9; pi++) {
        const el = document.createElement("div");
        el.className = "pulso";
        esfera.appendChild(el);
        pulsos.push({ el, activo: false, inicioT: 0, duracion: 0.5, par: null, espera: Math.random() * 1.4 });
      }
    }
    function actualizarPulsos(t: number) {
      for (const p of pulsos) {
        if (!p.activo) {
          p.espera -= 0.016;
          if (p.espera <= 0) {
            p.par = paresLista[(Math.random() * paresLista.length) | 0];
            p.duracion = 0.55 + Math.random() * 0.5;
            p.inicioT = t;
            p.activo = true;
          }
          continue;
        }
        const frac = (t - p.inicioT) / p.duracion;
        if (frac >= 1) {
          p.activo = false;
          p.espera = 0.25 + Math.random() * 1.6;
          p.el.style.opacity = "0";
          continue;
        }
        const { a, b } = p.par!;
        const x = a.x + (b.x - a.x) * frac;
        const y = a.y + (b.y - a.y) * frac;
        const z = a.z + (b.z - a.z) * frac;
        const brillo = Math.sin(Math.min(1, frac) * Math.PI);
        p.el.style.opacity = String(brillo);
        p.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px)`;
      }
    }

    // ---- aguja: apunta hacia el cursor, tomando como centro la posición
    // real en pantalla del compás. ----
    let targetDeg = 0, currentDeg = 0, velDeg = 0, lastX = 0, lastY = 0;
    let mouseNX = 0, mouseNY = 0, smNX = 0, smNY = 0;
    function onMouseMove(e: MouseEvent) {
      lastX = e.clientX;
      lastY = e.clientY;
      const rect = compasWrap!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      targetDeg = (Math.atan2(lastY - cy, lastX - cx) * 180) / Math.PI + 90;
      mouseNX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNY = (e.clientY / window.innerHeight) * 2 - 1;
    }
    if (!reduceMotion) window.addEventListener("mousemove", onMouseMove);

    // La esfera de puntos se generó con un radio fijo (200, ver arriba) —
    // para que crezca junto con .hero-compas-wrap (que sí es responsive,
    // en % de su columna — ver el comentario en landing.css) sin tener
    // que regenerar los puntos, se le aplica un scale() calculado contra
    // el tamaño real que ese compás termina midiendo. offsetWidth (no
    // getBoundingClientRect) a propósito: no lo afecta el propio
    // scale() de la animación de entrada del compás, así que mide el
    // tamaño real en CSS aunque se llame apenas montado, a mitad de esa
    // animación.
    let escalaEsferaBase = 1;
    function medirEscalaEsfera() {
      const ancho = compasWrap!.offsetWidth;
      escalaEsferaBase = ancho > 0 ? ancho / 420 : 1;
    }
    medirEscalaEsfera();
    window.addEventListener("resize", medirEscalaEsfera);

    // Barra de progreso de lectura de toda la página (no solo el hero) —
    // se actualiza en cada scroll, sin ningún efecto sobre el hero mismo.
    function onScroll() {
      const maxScrollBarra = document.documentElement.scrollHeight - window.innerHeight;
      const fraccionScroll = maxScrollBarra > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScrollBarra)) : 0;
      progresoScrollEl!.style.width = `${fraccionScroll * 100}%`;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    let raf = 0;
    const inicio = performance.now();
    let ultimoT = 0;
    let tituloActivado = false;
    function animar() {
      raf = requestAnimationFrame(animar);
      const t = (performance.now() - inicio) / 1000;
      const dt = Math.min(0.05, Math.max(0, t - ultimoT));
      ultimoT = t;

      const introCruda = reduceMotion ? 1 : Math.min(1, t / 1.1);
      const introEase = 1 - Math.pow(1 - introCruda, 3);
      if (!tituloActivado && introEase > 0.04) {
        h1!.classList.add("in");
        tituloActivado = true;
      }

      smNX += (mouseNX - smNX) * 0.06;
      smNY += (mouseNY - smNY) * 0.06;

      const entradaEscala = 0.6 + 0.4 * introEase;
      compasWrap!.style.opacity = String(introEase);
      compasWrap!.style.transform = `translate(calc(-50% + ${(smNX * 9).toFixed(1)}px), calc(-50% + ${(smNY * 7).toFixed(1)}px)) scale(${entradaEscala})`;
      compasZoom!.style.opacity = String(introEase);
      heroTexto!.style.opacity = String(introEase);

      // La esfera ya no crece ni se apaga con el scroll — gira sola todo
      // el tiempo, de forma ambiental, igual antes o después de hacer
      // scroll.
      const giroBase = reduceMotion ? 0 : t * 11;
      esfera!.style.transform = `scale(${escalaEsferaBase}) rotateY(${giroBase}deg) rotateX(6deg)`;
      orbita!.style.opacity = String(introEase);
      orbita!.style.transform = `translate(${(smNX * 20).toFixed(1)}px, ${(smNY * 15).toFixed(1)}px)`;
      actualizarPulsos(t);

      if (reduceMotion) {
        currentDeg = targetDeg;
      } else {
        const delta = shortestDelta(targetDeg - currentDeg);
        const RIGIDEZ = 210, AMORTIGUACION = 18;
        const aceleracion = delta * RIGIDEZ - velDeg * AMORTIGUACION;
        velDeg += aceleracion * dt;
        currentDeg += velDeg * dt;
      }
      needle!.style.transform = `rotate(${currentDeg}deg)`;
    }
    animar();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", medirEscalaEsfera);
    };
  }, []);

  if (vistaMovil) {
    // key distinto a propósito: sin esto, React reutiliza el mismo <div>
    // en la misma posición del árbol (mismo tag) en vez de desecharlo —
    // la animación del hero, que sigue corriendo en el fondo (el
    // useEffect de abajo nunca se limpia solo con este cambio de vista),
    // le seguía escribiendo estilos encima a ese nodo reciclado. El key
    // fuerza a React a desmontar de verdad el árbol viejo en cada cambio.
    return (
      <div key="vista-movil" className="mobile-preview-wrap">
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
    <div key="vista-escritorio" ref={rootRef}>
      <div className="progreso-scroll" ref={progresoScrollRef} aria-hidden="true" />
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
              <a
                href="/presentacion-comercial/index.html"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuAbierto(false)}
              >
                Presentación
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

      <div className="hero-fondo">
        <header className="hero" id="hero" ref={heroRef}>
          <div className="hero-grafico">
            <div className="hero-orbita" ref={orbitaRef}>
              <div className="hero-esfera" ref={esferaRef} />
            </div>

            <div className="hero-compas-wrap" ref={compasWrapRef}>
              <div className="hero-compas-zoom" ref={compasZoomRef}>
                <svg className="hero-motif" viewBox="0 0 200 200" fill="none" aria-hidden="true">
                  <path
                    className="ring"
                    d="M100 175 A75 75 0 1 1 151.34 154.68"
                    stroke="currentColor"
                    strokeWidth="1.1"
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
              </div>
            </div>
          </div>

          <div className="hero-texto" ref={heroTextoRef}>
            <h1 ref={h1Ref}>
              <span className="linea">
                {"Todo lo que necesita tu".split(" ").map((palabra, i) => (
                  <span key={i} className="palabra" style={{ "--i": i } as CSSProperties}>
                    {palabra}
                  </span>
                ))}
              </span>
              <span className="linea">
                {"empresa en un solo lugar".split(" ").map((palabra, i) => (
                  <span key={i + 5} className="palabra" style={{ "--i": i + 5 } as CSSProperties}>
                    {palabra}
                  </span>
                ))}
              </span>
            </h1>
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
          </div>
        </header>
      </div>

      <section className="chapter chapter-oscuro reveal reveal-sin-deslizar" id="ecosistema">
        <div className="wrap">
          <div className="chapter-head">
            <h2>Nuestro ecosistema</h2>
            <p className="subtitle">
              Cada módulo está conectado e interactúa con los demás, toda la gestión a un solo clic.
            </p>
          </div>
          <div className="eco-demo-stage">
            <EcosistemaDemo />
          </div>
          <div className="chapter-cta">
            <a
              className="btn"
              href="#contacto"
              onClick={(e) => {
                e.preventDefault();
                setPopupOrigen("Ecosistema");
              }}
            >
              Solicita tu prueba gratis de 15 días
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
              href="#contacto"
              onClick={(e) => {
                e.preventDefault();
                setPopupOrigen("Cómo funciona");
              }}
            >
              Solicita tu prueba gratis de 15 días
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
                Anual <span className="off-badge">-15% OFF</span>
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
                      <svg viewBox="0 0 24 24" fill="#1a1b33" aria-hidden="true">
                        <path d="M12 23c4.42 0 8-3.13 8-7.5 0-2.9-1.35-4.7-2.4-6.1-.3 1.3-1.1 2.1-1.1 2.1.3-2.5-.5-4.4-1.9-6.1-1.1-1.4-2.3-2.5-2.3-4.3C10.6 3.3 8 6.4 8 10.2c0 1.1.3 1.9.3 1.9C6.9 10.9 6 9.3 6 7.5 4.6 9.2 4 12 4 14.5 4 18.87 7.58 23 12 23z" />
                      </svg>
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
                href="#contacto"
                onClick={(e) => {
                  e.preventDefault();
                  setPopupOrigen(`Plan ${plan.nombre}`);
                }}
              >
                Solicita tu prueba gratis de 15 días
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
            <h2>Un ecosistema hecho por alguien que cree en las empresas</h2>
            <p>
              Después de ver de cerca cuánto tiempo y dinero pierden los
              negocios por no tener sus datos en un solo lugar, decidí construir la herramienta
              que a mí me hubiera gustado tener: un punto de partida claro, hecho a la medida de
              cada negocio, para que cualquier empresa pueda crecer sin necesitar su propio
              equipo de tecnología.
            </p>
          </div>
        </div>
      </dialog>

      <section className="chapter alt agenda-layout reveal" id="contacto">
        <div className="agenda-grid">
          <div className="agenda-texto">
            <h2>Hablemos de tu negocio</h2>
            <p className="sub">
              Agendemos una conversación de 20 minutos sin costo — elige el horario que mejor te
              sirva y quedas agendado al instante, con la invitación y el link de la
              videollamada directo a tu correo.
            </p>
          </div>
          <div className="agenda-formulario">
            <AgendarWidget />
          </div>
        </div>
      </section>

      {/* Mismo AgendarWidget de la sección de arriba, en un pop-up — para
          que los botones "Solicita tu prueba gratis" de Ecosistema, Cómo
          funciona y Precios no salten de golpe hasta el final de la
          página. La sección #contacto de arriba se queda igual, para
          quien llegue ahí bajando normal. key={popupOrigen}: cada vez que
          se abre es un origen (botón) distinto, así que arranca en blanco
          en vez de conservar el día/hora de una apertura anterior. */}
      <dialog
        className="agenda-dialog"
        ref={dialogAgendaRef}
        onClick={(e) => {
          if (e.target === dialogAgendaRef.current) dialogAgendaRef.current?.close();
        }}
        onClose={() => setPopupOrigen(null)}
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Cerrar"
          onClick={() => dialogAgendaRef.current?.close()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
          </svg>
        </button>
        {popupOrigen && (
          <div className="agenda-formulario">
            <AgendarWidget key={popupOrigen} origen={popupOrigen} />
          </div>
        )}
      </dialog>

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
