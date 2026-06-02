import { supabase } from "@/integrations/supabase/client";

export type AccionHistorial = "insert" | "update" | "delete";
export type TablaHistorial =
  | "productividad" | "perdidas" | "tallos" | "ramos_peso"
  | "tratamientos" | "siembras" | "causas_personalizadas" | "ensayos";

export async function logHistorial(args: {
  ensayo_codigo: string;
  accion: AccionHistorial;
  tabla: TablaHistorial;
  descripcion: string;
  registro_id?: string | null;
  datos?: Record<string, any> | null;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let nombre = user.email ?? "Usuario";
    const { data: p } = await supabase
      .from("profiles")
      .select("nombre_completo")
      .eq("user_id", user.id)
      .maybeSingle();
    if (p?.nombre_completo) nombre = p.nombre_completo;
    await supabase.from("historial").insert({
      ensayo_codigo: args.ensayo_codigo,
      user_id: user.id,
      user_nombre: nombre,
      accion: args.accion,
      tabla: args.tabla,
      registro_id: args.registro_id ?? null,
      descripcion: args.descripcion,
      datos: args.datos ?? null,
    });
  } catch (e) {
    console.error("No se pudo registrar en historial:", e);
  }
}