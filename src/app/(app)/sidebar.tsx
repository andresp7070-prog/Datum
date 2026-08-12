"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PuntoSelector } from "./punto-selector";
import { useNavegacion } from "./navegacion";
import type { PuntoVenta } from "@/lib/puntos";

// Clic normal (sin modificadores) navega vía startTransition, para que la
// pantalla anterior se quede visible con NavegandoOverlay encima en vez de
// desaparecer de golpe. Ctrl/Cmd/Shift/clic-central se dejan pasar tal cual,
// para no romper "abrir en pestaña nueva".
function manejarClic(
  e: React.MouseEvent<HTMLAnchorElement>,
  href: string,
  navegar: (href: string) => void,
) {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
    return;
  }
  e.preventDefault();
  navegar(href);
}

const modulos = [
  { nombre: "Resumen", href: "/resumen", slug: null },
  { nombre: "Ventas", href: "/ventas", slug: "ventas" },
  { nombre: "CRM", href: "/crm", slug: "crm" },
  { nombre: "Inventario", href: "/inventario", slug: "inventario" },
  { nombre: "Estado P y G", href: "/pyg", slug: "pyg" },
  { nombre: "Panel de control", href: "/insights", slug: "insights" },
  { nombre: "Promociones", href: "/promociones", slug: "promociones" },
  { nombre: "Nómina", href: "/nomina", slug: "nomina" },
];

const enlacesAdmin = [
  { nombre: "Panel", href: "/admin" },
  { nombre: "Panel de control", href: "/admin/panel" },
  { nombre: "CRM", href: "/admin/leads" },
  { nombre: "Estado P y G", href: "/admin/finanzas" },
  { nombre: "Enviar bienvenida", href: "/admin/bienvenida" },
  { nombre: "Probar correos", href: "/admin/correos" },
];

function IconoCandado() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 7V4.8a3 3 0 0 1 6 0V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function LogoCompass({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={`${className} shrink-0`} aria-hidden="true">
      <path
        d="M 24 42 A 18 18 0 1 1 36.321 37.122"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M24 10 L29 24 L24 38 L19 24 Z" fill="currentColor" />
    </svg>
  );
}

function estaHabilitado(
  modulo: (typeof modulos)[number],
  modulosActivos: string[],
  esVendedor: boolean,
) {
  if (esVendedor) return modulo.slug === "ventas";
  return modulo.slug === null || modulosActivos.includes(modulo.slug);
}

export function Sidebar({
  modulosActivos,
  rolEmpresa,
  esAdmin = false,
  puntosVenta = [],
  puntoSeleccionado = null,
  mostrarSelectorPunto = false,
  puntoFijoNombre = null,
}: {
  modulosActivos: string[];
  rolEmpresa: "administrador" | "vendedor";
  esAdmin?: boolean;
  puntosVenta?: PuntoVenta[];
  puntoSeleccionado?: string | null;
  mostrarSelectorPunto?: boolean;
  puntoFijoNombre?: string | null;
}) {
  const pathname = usePathname();
  const { navegar } = useNavegacion();
  const esVendedor = rolEmpresa === "vendedor";

  const habilitados = modulos.filter((m) => estaHabilitado(m, modulosActivos, esVendedor));
  // Para un vendedor, lo que no ve no es porque falte en el plan — es su rol.
  // No tiene sentido mostrarle candados de "no incluido en tu plan".
  const bloqueados = esVendedor
    ? []
    : modulos.filter((m) => !estaHabilitado(m, modulosActivos, esVendedor));

  if (esAdmin) {
    return (
      <nav className="flex w-56 shrink-0 flex-col justify-between border-r border-gray-200 p-4">
        <div>
          <div className="mb-6 flex items-center gap-3 px-3 text-accent">
            <LogoCompass className="h-9 w-9" />
            <span className="font-serif text-4xl font-semibold text-gray-900">Datum</span>
          </div>
          <ul className="space-y-1">
            {enlacesAdmin.map((enlace) => {
              // "/admin" es prefijo de todas las demás rutas de este menú
              // (/admin/leads, /admin/finanzas...) — sin este caso especial,
              // "Panel" y la sección en la que de verdad estás quedan
              // marcadas activas al mismo tiempo.
              const activo =
                enlace.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === enlace.href || pathname.startsWith(`${enlace.href}/`);
              return (
                <li key={enlace.href}>
                  <Link
                    href={enlace.href}
                    onClick={(e) => manejarClic(e, enlace.href, navegar)}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                      activo ? "bg-accent text-white" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {enlace.nombre}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex items-center gap-1.5 px-3 text-[11px] whitespace-nowrap text-gray-300">
          <LogoCompass className="h-3 w-3 shrink-0" />
          <span>Desarrollado por Datum</span>
        </div>
      </nav>
    );
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col justify-between border-r border-gray-200 p-4">
      <div>
        <div className="mb-6 flex items-center gap-3 px-3 text-accent">
          <LogoCompass className="h-9 w-9" />
          <span className="font-serif text-4xl font-semibold text-gray-900">Datum</span>
        </div>

        {mostrarSelectorPunto && (
          <div className="mb-3">
            <PuntoSelector puntos={puntosVenta} seleccionado={puntoSeleccionado} />
          </div>
        )}
        {!mostrarSelectorPunto && puntoFijoNombre && (
          <div className="mb-3 px-3 py-2">
            <p className="text-xs font-medium text-gray-400">Punto de venta</p>
            <p className="text-sm text-gray-700">{puntoFijoNombre}</p>
          </div>
        )}

        <ul className="space-y-1">
          {habilitados.map((modulo) => {
            const activo = pathname === modulo.href || pathname.startsWith(`${modulo.href}/`);
            return (
              <li key={modulo.href}>
                <Link
                  href={modulo.href}
                  onClick={(e) => manejarClic(e, modulo.href, navegar)}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                    activo ? "bg-accent text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {modulo.nombre}
                </Link>
              </li>
            );
          })}
        </ul>

        {bloqueados.length > 0 && (
          <>
            <hr className="my-3 border-gray-200" />
            <ul className="space-y-1">
              {bloqueados.map((modulo) => (
                <li key={modulo.href}>
                  <span
                    title="No incluido en tu plan actual"
                    className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-400"
                  >
                    {modulo.nombre}
                    <IconoCandado />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-3 text-[11px] whitespace-nowrap text-gray-300">
        <LogoCompass className="h-3 w-3 shrink-0" />
        <span>Desarrollado por Datum</span>
      </div>
    </nav>
  );
}
