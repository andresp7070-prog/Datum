import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esRolDePlataforma } from "@/lib/empresa";
import { obtenerTokensAceptacionWompi } from "@/lib/wompi";
import { SelectorMetodoPago } from "./selector-metodo-pago";

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
    .select("monto_mensual, facturacion")
    .eq("empresa_id", perfil.empresa_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sin suscripción no hay nada que cobrar — ahí sí esta pantalla no tiene
  // sentido.
  if (!suscripcion) redirect("/");

  // Ya no redirige si la empresa tiene una tarjeta guardada — con varias
  // tarjetas permitidas (ver metodos_pago en schema.sql), esta pantalla
  // sirve tanto para la primera como para agregar una adicional. Se
  // revisa acá (no en metodos-pago/page.tsx) solo para cambiar el texto
  // de abajo según el caso.
  const { count: metodosExistentes } = await supabase
    .from("metodos_pago")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", perfil.empresa_id);
  const esLaPrimera = !metodosExistentes;

  const tokens = await obtenerTokensAceptacionWompi();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Agrega un método de pago</h1>
        <p className="mb-6 text-sm text-gray-500">
          {empresa?.nombre ? `${empresa.nombre}: ` : ""}
          {esLaPrimera ? (
            <>
              tu período de prueba ya terminó. Para seguir usando Datum, agrega un método de pago
              — se te cobrará{" "}
              <strong>
                ${Number(suscripcion.monto_mensual).toLocaleString("es-CO")} COP
                {suscripcion.facturacion === "anual" ? "/año" : "/mes"}
              </strong>
              .
            </>
          ) : (
            <>
              este método queda guardado junto a los demás — puedes elegir después, desde{" "}
              <strong>Mis métodos de pago</strong>, cuál quieres usar para cobrar.
            </>
          )}{" "}
          Los datos de tu tarjeta o cuenta nunca se guardan en los servidores de Datum: quedan
          directamente en Wompi, la pasarela de pago.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <SelectorMetodoPago
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
