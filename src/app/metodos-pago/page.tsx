import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { esRolDePlataforma } from "@/lib/empresa";
import { ListaMetodosPago } from "./lista-metodos-pago";

export default async function MetodosPagoPage() {
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

  const { data: metodos } = await supabase
    .from("metodos_pago")
    .select("id, tarjeta_marca, tarjeta_ultimos_digitos, es_predeterminado, creado_en")
    .eq("empresa_id", perfil.empresa_id)
    .order("creado_en", { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Mis métodos de pago</h1>
          <Link href="/cuenta" className="text-sm text-gray-500 hover:text-gray-700">
            ← Mi cuenta
          </Link>
        </div>

        {metodos && metodos.length > 0 ? (
          <ListaMetodosPago metodos={metodos} />
        ) : (
          <p className="mb-4 text-sm text-gray-500">Todavía no tienes ninguna tarjeta guardada.</p>
        )}

        <Link
          href="/agregar-metodo-pago"
          className="mt-4 block rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover"
        >
          Agregar una tarjeta
        </Link>
      </div>
    </div>
  );
}
