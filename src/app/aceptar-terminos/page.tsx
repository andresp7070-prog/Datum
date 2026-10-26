import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esRolDePlataforma } from "@/lib/empresa";
import { ContratoCompleto, VERSION_CONTRATO } from "./contrato";
import { aceptarTerminos } from "./actions";

export default async function AceptarTerminosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id || esRolDePlataforma(perfil.rol)) {
    redirect("/");
  }

  const { data: empresa } = await supabase
    .from("empresas")
    .select(
      "nombre, nit, ciudad, representante_legal_nombre, representante_legal_cc, modulos_activos, terminos_aceptados_en",
    )
    .eq("id", perfil.empresa_id)
    .single();

  if (!empresa) redirect("/");
  // Ya aceptó antes — no tiene sentido volver a mostrarle esto si entra
  // a esta dirección de nuevo a mano.
  if (empresa.terminos_aceptados_en) redirect("/");

  const { data: suscripcion } = await supabase
    .from("suscripciones")
    .select("plan, monto_mensual, facturacion")
    .eq("empresa_id", perfil.empresa_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">
          Antes de continuar, acepta el contrato
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Esto reemplaza la firma del contrato en papel — léelo con calma. Puedes volver a
          encontrarlo más adelante escribiéndonos a{" "}
          <a href="mailto:andresp7070@gmail.com" className="underline">
            andresp7070@gmail.com
          </a>
          .
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-gray-200 p-5">
          <ContratoCompleto
            empresaNombre={empresa.nombre}
            nit={empresa.nit}
            ciudad={empresa.ciudad}
            representanteNombre={empresa.representante_legal_nombre}
            representanteCC={empresa.representante_legal_cc}
            plan={suscripcion?.plan ?? null}
            modulosActivos={empresa.modulos_activos ?? []}
            montoMensual={suscripcion?.monto_mensual ?? null}
            facturacion={suscripcion?.facturacion ?? null}
          />
        </div>

        <form action={aceptarTerminos} className="mt-6 flex items-center justify-between gap-4 border-t border-gray-200 pt-5">
          <p className="text-xs text-gray-500">
            Al presionar &quot;Acepto&quot; en nombre de <strong>{empresa.nombre}</strong> quedará
            registrada la fecha y hora exacta como tu firma electrónica (versión {VERSION_CONTRATO}
            ).
          </p>
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Acepto
          </button>
        </form>
      </div>
    </div>
  );
}
