import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActivarFactus } from "./activar-factus";
import { CentroFactus, EncabezadoFactus } from "./encabezado-factus";

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

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
    .select("estado, certificado_facturacion, certificado_monto, terminos_aceptados_en")
    .eq("empresa_id", perfil.empresa_id)
    .maybeSingle();

  if (!integracion) {
    return (
      <CentroFactus>
        <EncabezadoFactus />
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
    const facturacionCertificado =
      integracion.certificado_facturacion === "anual" ? "Anual" : "Mensual";
    const periodo = integracion.certificado_facturacion === "anual" ? "/año" : "/mes";

    return (
      <CentroFactus>
        <EncabezadoFactus />
        <div className="rounded-xl border border-amber-600/20 bg-amber-600/5 p-5">
          <span className="mb-3 inline-block rounded-full bg-amber-600 px-2.5 py-1 text-xs font-medium text-white">
            Activo
          </span>
          <p className="text-sm text-gray-700">
            Este servicio ya está activo para tu empresa — tus facturas electrónicas se emiten
            a través de Factus, el proveedor tecnológico autorizado por la DIAN.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Tu configuración actual</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Por documento emitido</dt>
              <dd className="font-medium text-gray-900">$99 COP</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Certificado digital</dt>
              <dd className="font-medium text-gray-900">
                {facturacionCertificado}
                {integracion.certificado_monto != null
                  ? ` — ${formatoMoneda(Number(integracion.certificado_monto))}${periodo}`
                  : ""}
              </dd>
            </div>
            {integracion.terminos_aceptados_en && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Activo desde</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(integracion.terminos_aceptados_en).toLocaleDateString("es-CO")}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </CentroFactus>
    );
  }

  if (integracion.estado === "suspendida") {
    return (
      <CentroFactus>
        <EncabezadoFactus />
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
