import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Se salta Row Level Security a propósito — usarlo con cuidado, solo desde
// código de servidor, y solo cuando de verdad no hay ninguna sesión con la
// que autenticar la operación. Cinco usos legítimos hoy:
// 1. El formulario público de agendamiento de la landing (src/lib/agendar.ts):
//    un visitante sin cuenta en Datum agenda una reunión, así que no hay
//    sesión de usuario posible — se usa este cliente, con mucho cuidado, solo
//    para leer el refresh_token de Google guardado por el admin y para crear
//    el lead/evento resultante en las tablas internas de Datum.
// 2. Crear una empresa cliente nueva (src/app/(app)/admin/clientes/nuevo/
//    actions.ts): acá SÍ hay una sesión (la de Andrés, verificada con
//    requerirAdmin() antes de tocar este archivo), pero RLS no sirve para
//    esta operación — las políticas de "empresas"/"perfiles" están armadas
//    para que cada quien vea/edite SU PROPIA empresa (mi_empresa_id()), y acá
//    justo se está creando una empresa que todavía no es de nadie. También
//    necesita el Admin API de Supabase Auth (crear el usuario en auth.users),
//    al que tampoco se llega con la sesión normal del navegador.
// 3. Guardar el método de pago de Wompi de un cliente (guardarMetodoPago()
//    en src/lib/metodos-pago.ts, usado tanto por /api/wompi/
//    guardar-metodo-pago como por /api/wompi/bancolombia-callback): acá SÍ
//    hay sesión (la del propio cliente), pero desde que se cerró el
//    permiso de edición sobre "suscripciones" (ver schema.sql, sección
//    "COBRO AUTOMÁTICO CON WOMPI") esa sesión solo puede leer su propia
//    fila, nunca escribirla — a propósito, para que nadie pueda marcarse
//    "activo" sin haber pagado de verdad. Solo se usa después de que
//    Wompi ya confirmó que la tarjeta o cuenta quedó tokenizada.
// 4. El webhook de Wompi (src/app/api/webhooks/wompi/route.ts) y el cron
//    de cobro diario (src/app/api/cron/cobro-suscripciones/route.ts): a
//    ninguno de los dos lo llama una persona con sesión — no hay forma de
//    que exista una. El webhook valida la firma del aviso antes de confiar
//    en cualquier dato (ver verificarFirmaEventoWompi en src/lib/wompi.ts).
// 5. Cambiar el plan de un cliente que ya existe (src/app/(app)/admin/
//    clientes/[id]/editar/actions.ts): acá SÍ hay sesión (la de Andrés,
//    verificada con requerirAdmin()), pero igual que en el punto 3,
//    "suscripciones" ya no acepta escritura desde ninguna sesión normal,
//    ni siquiera la de un admin — solo lectura.
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
