import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Único lugar del proyecto donde se usa la service role key — se salta Row
// Level Security a propósito, porque este cliente lo usa el cron del
// resumen semanal (src/app/api/cron/resumen-semanal/route.ts), que corre
// sin ninguna persona con sesión iniciada y necesita leer las ventas de
// TODAS las empresas para mandarle a cada una su propio correo. Nunca
// importar esto desde un componente de cliente ni desde una ruta que
// reciba peticiones de un usuario final directamente.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
