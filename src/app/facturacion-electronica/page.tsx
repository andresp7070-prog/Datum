import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActivarFactus } from "./activar-factus";
import { CentroFactus, EncabezadoFactus } from "./encabezado-factus";

export default async function FacturacionElectronicaPage() {
  const perfil = await getPerfilActual();
  if (!perfil?.empresa_id || esRolDePlataforma(perfil.rol)) {
    redirect("/");
  }

  // La sesión normal del cliente no puede leer integraciones_factus (RLS
  // es "solo admin" — guarda credenciales de un proveedor externo, ver
  // schema.sql). Esta es la única pantalla donde un cliente necesita saber
  // si tiene algo pendiente acá, así que se lee con la llave de servicio,
  // sin exponer nunca las credenciales al navegador — séptimo uso legítimo
  // de esa llave (ver src/lib/supabase/admin.ts).
  const supabase = createAdminClient();
  const { data: integracion } = await supabase
    .from("integraciones_factus")
    .select("estado, certificado_facturacion")
    .eq("empresa_id", perfil.empresa_id)
    .maybeSingle();

  if (!integracion) {
    return (
      <CentroFactus>
        <EncabezadoFactus tinte="neutral" />
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <p className="text-sm text-gray-600">
            Es un servicio adicional y opcional, aparte de tu suscripción: Datum conecta tus
            ventas con un proveedor autorizado por la DIAN para emitir tus facturas
            electrónicas, cobrado por cada documento que emitas.
          </p>
          <a
            href="mailto:andresp7070@gmail.com?subject=Quiero%20facturaci%C3%B3n%20electr%C3%B3nica"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Escríbenos para activarlo
          </a>
        </div>
      </CentroFactus>
    );
  }

  if (integracion.estado === "activa") {
    return (
      <CentroFactus>
        <EncabezadoFactus tinte="exito" />
        <div className="rounded-xl border border-amber-600/20 bg-amber-600/5 p-5">
          <span className="mb-3 inline-block rounded-full bg-amber-600 px-2.5 py-1 text-xs font-medium text-white">
            Activo
          </span>
          <p className="text-sm text-gray-700">
            Este servicio ya está activo para tu empresa — tus facturas electrónicas se emiten
            a través de Factus, el proveedor tecnológico autorizado por la DIAN.
          </p>
        </div>
      </CentroFactus>
    );
  }

  if (integracion.estado === "suspendida") {
    return (
      <CentroFactus>
        <EncabezadoFactus tinte="alerta" />
        <div className="rounded-xl border border-red-500/20 bg-red-50 p-5">
          <p className="text-sm text-red-700">Este servicio está suspendido para tu empresa.</p>
          <a
            href="mailto:andresp7070@gmail.com?subject=Regularizar%20facturaci%C3%B3n%20electr%C3%B3nica"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Escríbenos para regularizarlo
          </a>
        </div>
      </CentroFactus>
    );
  }

  return (
    <CentroFactus>
      <ActivarFactus facturacionSugerida={integracion.certificado_facturacion} />
    </CentroFactus>
  );
}
