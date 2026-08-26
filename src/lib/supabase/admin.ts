import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Se salta Row Level Security a propósito — usarlo con cuidado, solo desde
// código de servidor, y solo cuando de verdad no hay ninguna sesión con la
// que autenticar la operación. Tres usos legítimos hoy:
// 1. El cron del resumen semanal (src/app/api/cron/resumen-semanal/route.ts),
//    que corre sin ninguna persona con sesión iniciada y necesita leer las
//    ventas de TODAS las empresas para mandarle a cada una su propio correo.
// 2. El formulario público de agendamiento de la landing (src/lib/agendar.ts):
//    un visitante sin cuenta en Datum agenda una reunión, así que no hay
//    sesión de usuario posible — se usa este cliente, con mucho cuidado, solo
//    para leer el refresh_token de Google guardado por el admin y para crear
//    el lead/evento resultante en las tablas internas de Datum.
// 3. Crear una empresa cliente nueva (src/app/(app)/admin/clientes/nuevo/
//    actions.ts): acá SÍ hay una sesión (la de Andrés, verificada con
//    requerirAdmin() antes de tocar este archivo), pero RLS no sirve para
//    esta operación — las políticas de "empresas"/"perfiles" están armadas
//    para que cada quien vea/edite SU PROPIA empresa (mi_empresa_id()), y acá
//    justo se está creando una empresa que todavía no es de nadie. También
//    necesita el Admin API de Supabase Auth (crear el usuario en auth.users),
//    al que tampoco se llega con la sesión normal del navegador.
// Nunca importar esto desde un componente de cliente. Si se usa desde una
// ruta pública que recibe peticiones de un usuario final sin sesión (como el
// caso 2), esa ruta debe validar cuidadosamente su propia entrada — este
// cliente no tiene ningún control de acceso propio.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
