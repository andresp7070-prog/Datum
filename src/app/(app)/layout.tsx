import { redirect } from "next/navigation";
import Link from "next/link";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
import { obtenerContextoPunto } from "@/lib/puntos";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./sidebar";
import { PopupActualizacion } from "./popup-actualizacion";
import { NavegacionProvider } from "./navegacion";
import { NavegandoOverlay } from "./navegando-overlay";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilActual();

  if (!perfil) {
    redirect("/login");
  }

  if (perfil.debe_cambiar_password) {
    redirect("/cambiar-password");
  }

  // Una cuenta limitada a un punto de venta (ej. Florida) no ve el menú
  // normal de la plataforma en absoluto — su única pantalla es el kiosko de
  // autopedido de ese punto. No hay forma de navegar a otro lado desde acá.
  if (perfil.punto_venta_id) {
    redirect(`/pedir/${perfil.punto_venta_id}`);
  }

  const esDePlataforma = esRolDePlataforma(perfil.rol);

  // Reemplaza la firma física del contrato — ver schema.sql, sección
  // "ACEPTACIÓN DEL CONTRATO DENTRO DE LA PLATAFORMA". Toda cuenta cliente
  // (nunca una de plataforma, que no le "firma" un contrato a sí misma)
  // tiene que aceptarlo antes de ver cualquier otra pantalla — incluidas
  // las cuentas que ya existían antes de que esto se construyera, porque
  // ninguna tiene terminos_aceptados_en todavía.
  if (!esDePlataforma && !perfil.empresas?.terminos_aceptados_en) {
    redirect("/aceptar-terminos");
  }

  let puntosVenta: { id: string; nombre: string }[] = [];
  let puntoSeleccionado: string | null = null;
  let mostrarSelectorPunto = false;
  let actualizacionPendiente: { id: string; titulo: string; contenido: string } | null = null;

  if (!esDePlataforma) {
    const supabase = await createClient();

    // Tercer gate (después de cambiar la contraseña y aceptar el
    // contrato): si ya se venció la prueba gratuita y la empresa todavía
    // no tiene ninguna tarjeta guardada en Wompi (ver metodos_pago en
    // schema.sql — ahora puede haber varias, no una sola), no puede
    // seguir usando la plataforma hasta que agregue al menos una — ver
    // CLAUDE.md, sección "Cobros".
    const { data: suscripcion } = await supabase
      .from("suscripciones")
      .select("fecha_fin_prueba")
      .eq("empresa_id", perfil.empresa_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pruebaVencida = suscripcion?.fecha_fin_prueba
      ? new Date(suscripcion.fecha_fin_prueba) < new Date()
      : false;

    if (pruebaVencida) {
      const { count: metodosExistentes } = await supabase
        .from("metodos_pago")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", perfil.empresa_id);
      if (!metodosExistentes) {
        redirect("/agregar-metodo-pago");
      }
    }

    if (perfil.empresa_id) {
      const contexto = await obtenerContextoPunto(supabase, perfil.empresa_id, perfil.punto_venta_id);
      puntosVenta = contexto.puntosVenta;
      puntoSeleccionado = contexto.puntoSeleccionado;
      mostrarSelectorPunto = contexto.mostrarSelector;
    }

    const { data: ultimaActualizacion } = await supabase
      .from("actualizaciones")
      .select("id, titulo, contenido")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimaActualizacion && ultimaActualizacion.id !== perfil.ultima_actualizacion_vista_id) {
      actualizacionPendiente = ultimaActualizacion;
    }
  }

  return (
    <NavegacionProvider>
      <div className="flex min-h-screen">
        {actualizacionPendiente && <PopupActualizacion actualizacion={actualizacionPendiente} />}
        <Sidebar
          modulosActivos={perfil.empresas?.modulos_activos ?? []}
          rolEmpresa={perfil.rol_empresa}
          esAdmin={esDePlataforma}
          puntosVenta={puntosVenta}
          puntoSeleccionado={puntoSeleccionado}
          mostrarSelectorPunto={mostrarSelectorPunto}
          puntoFijoNombre={
            !mostrarSelectorPunto && perfil.punto_venta_id
              ? (puntosVenta.find((p) => p.id === perfil.punto_venta_id)?.nombre ?? null)
              : null
          }
        />
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between bg-accent px-6 py-4">
            <span className="text-sm text-[#c7c8dd]">{perfil.nombre}</span>
            <Link
              href="/cuenta"
              className="rounded-lg border border-[#3f4166] px-3 py-1.5 text-sm text-[#e3e3ef] hover:bg-accent-hover"
            >
              Mi cuenta
            </Link>
          </header>
          <main className="relative flex-1 p-6">
            {children}
            <NavegandoOverlay />
          </main>
        </div>
      </div>
    </NavegacionProvider>
  );
}
