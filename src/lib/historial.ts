import { supabase } from "@/integrations/supabase/client";

export type AccionHistorial = "insert" | "update" | "delete";
export type TablaHistorial =
  | "productividad" | "perdidas" | "tallos" | "ramos_peso" | "diametros"
  | "tratamientos" | "siembras" | "causas" | "ensayos" | "profiles";

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
    if ((p as any)?.nombre_completo) nombre = (p as any).nombre_completo;
    cached = { id: user.id, nombre };
    return cached;
  })();
  const r = await pending;
  pending = null;
  return r;
}

supabase.auth.onAuthStateChange(() => { cached = null; pending = null; });

export function logHistorial(args: {
  ensayo_id: string | null;
  sede_id?: string | null;
  accion: AccionHistorial;
  tabla: TablaHistorial;
  descripcion: string;
  registro_id?: string | null;
  datos?: Record<string, any> | null;
}): void {
  (async () => {
    try {
      const u = await getUserInfo();
      if (!u) return;
      await supabase.from("historial").insert({
        ensayo_id: args.ensayo_id ?? null,
        sede_id: args.sede_id ?? null,
        user_id: u.id,
        user_nombre: u.nombre,
        accion: args.accion,
        tabla: args.tabla,
        registro_id: args.registro_id ?? null,
        descripcion: args.descripcion,
        datos: args.datos ?? null,
      });
    } catch (e) {
      console.error("historial:", e);
    }
  })();
}
