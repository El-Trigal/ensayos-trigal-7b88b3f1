import { supabase } from "@/integrations/supabase/client";

export type AccionHistorial = "insert" | "update" | "delete";
export type TablaHistorial =
  | "productividad" | "perdidas" | "tallos" | "ramos_peso"
  | "tratamientos" | "siembras" | "causas_personalizadas" | "ensayos";

type UserInfo = { id: string; nombre: string };
let cached: UserInfo | null = null;
let pending: Promise<UserInfo | null> | null = null;

async function getUserInfo(): Promise<UserInfo | null> {
  if (cached) return cached;
  if (pending) return pending;
  pending = (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    let nombre = user.email ?? "Usuario";
    const { data: p } = await supabase
      .from("profiles")
      .select("nombre_completo")
      .eq("user_id", user.id)
      .maybeSingle();
    if (p?.nombre_completo) nombre = p.nombre_completo;
    cached = { id: user.id, nombre };
    return cached;
  })();
  const r = await pending;
  pending = null;
  return r;
}

supabase.auth.onAuthStateChange(() => { cached = null; pending = null; });

export function logHistorial(args: {
  ensayo_codigo: string;
  accion: AccionHistorial;
  tabla: TablaHistorial;
  descripcion: string;
  registro_id?: string | null;
  datos?: Record<string, any> | null;
}): void {
  // Fire-and-forget: never block the UI save flow on audit logging.
  (async () => {
    try {
      const u = await getUserInfo();
      if (!u) return;
      await supabase.from("historial").insert({
        ensayo_codigo: args.ensayo_codigo,
        user_id: u.id,
        user_nombre: u.nombre,
        accion: args.accion,
        tabla: args.tabla,
        registro_id: args.registro_id ?? null,
        descripcion: args.descripcion,
        datos: args.datos ?? null,
      });
    } catch (e) {
      console.error("No se pudo registrar en historial:", e);
    }
  })();
}