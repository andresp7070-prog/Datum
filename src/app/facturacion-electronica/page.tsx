import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActivarFactus } from "./activar-factus";

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
      <div className="max-w-xl">
        <h1 className="mb-2 text-lg font-semibold text-gray-900">Facturación electrónica</h1>
        <p className="text-sm text-gray-500">
          Todavía no tienes este servicio disponible para activar. Si te interesa, escríbenos a{" "}
          <a href="mailto:andresp7070@gmail.com" className="underline">
            andresp7070@gmail.com
          </a>
          .
        </p>
      </div>
    );
  }

  if (integracion.estado === "activa") {
    return (
      <div className="max-w-xl">
        <h1 className="mb-2 text-lg font-semibold text-gray-900">Facturación electrónica</h1>
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Este servicio ya está activo para tu empresa.
        </p>
      </div>
    );
  }

  if (integracion.estado === "suspendida") {
    return (
      <div className="max-w-xl">
        <h1 className="mb-2 text-lg font-semibold text-gray-900">Facturación electrónica</h1>
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Este servicio está suspendido. Escríbenos a{" "}
          <a href="mailto:andresp7070@gmail.com" className="underline">
            andresp7070@gmail.com
          </a>{" "}
          para regularizarlo.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <ActivarFactus facturacionSugerida={integracion.certificado_facturacion} />
    </div>
  );
}
