import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esRolDePlataforma } from "@/lib/empresa";
import { obtenerTokensAceptacionWompi } from "@/lib/wompi";
import { FormularioMetodoPago } from "./formulario-metodo-pago";

export default async function AgregarMetodoPagoPage({
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
    .select("nombre")
    .eq("id", perfil.empresa_id)
    .single();

  const { data: suscripcion } = await supabase
    .from("suscripciones")
    .select("monto_mensual, facturacion, wompi_fuente_pago_id")
    .eq("empresa_id", perfil.empresa_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sin suscripción no hay nada que cobrar — ahí sí esta pantalla no tiene
  // sentido. Con una fuente de pago ya guardada, esta misma pantalla sirve
  // para reemplazarla (ver "Mi cuenta" → Cambiar método de pago) — no
  // redirige, solo cambia el texto de abajo según el caso.
  if (!suscripcion) redirect("/");

  const yaTieneTarjeta = Boolean(suscripcion.wompi_fuente_pago_id);

  const tokens = await obtenerTokensAceptacionWompi();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">
          {yaTieneTarjeta ? "Cambia tu método de pago" : "Agrega tu método de pago"}
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          {empresa?.nombre ? `${empresa.nombre}: ` : ""}
          {yaTieneTarjeta ? (
            <>
              reemplaza la tarjeta guardada — se sigue cobrando{" "}
              <strong>
                ${Number(suscripcion.monto_mensual).toLocaleString("es-CO")} COP
                {suscripcion.facturacion === "anual" ? "/año" : "/mes"}
              </strong>
              , en la fecha que ya tenías programada.
            </>
          ) : (
            <>
              tu período de prueba ya terminó. Para seguir usando Datum, agrega una tarjeta — se
              te cobrará{" "}
              <strong>
                ${Number(suscripcion.monto_mensual).toLocaleString("es-CO")} COP
                {suscripcion.facturacion === "anual" ? "/año" : "/mes"}
              </strong>
              .
            </>
          )}{" "}
          Tu tarjeta nunca se guarda en los servidores de Datum: queda directamente en Wompi, la
          pasarela de pago.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <FormularioMetodoPago
          llavePublica={process.env.LLAVE_PUBLICA_WOMPI ?? ""}
          acceptanceToken={tokens.acceptanceToken}
          acceptPersonalAuth={tokens.acceptPersonalAuth}
          permalinkTerminos={tokens.permalinkTerminos}
          permalinkDatosPersonales={tokens.permalinkDatosPersonales}
        />
      </div>
    </div>
  );
}
