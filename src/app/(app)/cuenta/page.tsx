import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/empresa";
import { SignOutButton } from "@/components/signout-button";
import { LogoTarjeta } from "@/components/logo-tarjeta";
import { CambiarPasswordForm } from "./cambiar-password-form";

const etiquetaEstado: Record<string, { texto: string; clase: string }> = {
  prueba: { texto: "En prueba gratis", clase: "text-amber-600" },
  activa: { texto: "Activa", clase: "text-green-700" },
  vencida: { texto: "Vencida", clase: "text-red-600" },
  cancelada: { texto: "Cancelada", clase: "text-gray-400" },
};

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let suscripcion: {
    estado: string;
    fecha_fin_prueba: string;
    monto_mensual: number;
  } | null = null;

  let metodoPredeterminado: {
    metodo_marca: string | null;
    metodo_ultimos_digitos: string | null;
  } | null = null;

  if (perfil.empresa_id && perfil.rol_empresa === "administrador") {
    const { data } = await supabase
      .from("suscripciones")
      .select("estado, fecha_fin_prueba, monto_mensual")
      .eq("empresa_id", perfil.empresa_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    suscripcion = data;

    const { data: metodo } = await supabase
      .from("metodos_pago")
      .select("metodo_marca, metodo_ultimos_digitos")
      .eq("empresa_id", perfil.empresa_id)
      .eq("es_predeterminado", true)
      .maybeSingle();
    metodoPredeterminado = metodo;
  }

  const diasDePrueba = suscripcion
    ? Math.max(
        0,
        Math.ceil((new Date(suscripcion.fecha_fin_prueba).getTime() - new Date().getTime()) / 86400000),
      )
    : null;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Mi cuenta</h1>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Datos de la cuenta</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-gray-400">Nombre</dt>
            <dd className="font-medium text-gray-900">{perfil.nombre ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Correo</dt>
            <dd className="font-medium text-gray-900">{user?.email ?? "—"}</dd>
          </div>
          {perfil.empresas && (
            <div>
              <dt className="text-gray-400">Empresa</dt>
              <dd className="font-medium text-gray-900">{perfil.empresas.nombre}</dd>
            </div>
          )}
          <div>
            <dt className="text-gray-400">Rol</dt>
            <dd className="font-medium text-gray-900">
              {perfil.rol_empresa === "administrador" ? "Administrador" : "Vendedor"}
            </dd>
          </div>
        </dl>
      </div>

      {perfil.rol_empresa === "administrador" && perfil.empresa_id && (
        <div className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Suscripción</h2>
          {suscripcion ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-400">Estado</dt>
                <dd className={`font-medium ${etiquetaEstado[suscripcion.estado]?.clase ?? "text-gray-900"}`}>
                  {etiquetaEstado[suscripcion.estado]?.texto ?? suscripcion.estado}
                </dd>
              </div>
              {suscripcion.estado === "prueba" && (
                <div>
                  <dt className="text-gray-400">Días de prueba restantes</dt>
                  <dd className="font-medium text-gray-900">
                    {diasDePrueba} {diasDePrueba === 1 ? "día" : "días"}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-gray-400">Precio mensual</dt>
                <dd className="font-medium text-gray-900">
                  {Number(suscripcion.monto_mensual).toLocaleString("es-CO", {
                    style: "currency",
                    currency: "COP",
                  })}
                </dd>
              </div>
              {metodoPredeterminado && (
                <div>
                  <dt className="text-gray-400">Método de pago</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                    <LogoTarjeta marca={metodoPredeterminado.metodo_marca} />
                    <span className="font-medium text-gray-900">
                      {metodoPredeterminado.metodo_ultimos_digitos
                        ? `${metodoPredeterminado.metodo_marca === "Bancolombia" ? "Bancolombia " : ""}•••• ${metodoPredeterminado.metodo_ultimos_digitos}`
                        : "Método de pago guardado"}
                    </span>
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      Predeterminado
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">Todavía no hay información de suscripción registrada.</p>
          )}
          {suscripcion && (
            <Link
              href="/metodos-pago"
              className="mt-4 block rounded-lg border border-gray-200 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Métodos de pago
            </Link>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Cambiar contraseña</h2>
        <CambiarPasswordForm error={error} />
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <SignOutButton />
      </div>
    </div>
  );
}
