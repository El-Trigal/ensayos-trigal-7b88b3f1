import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { dbError } from "@/lib/utils";

type Ensayo = {
  id: string;
  codigo: string;
  nombre: string | null;
  sede_nombre: string | null;
  created_at: string;
};

const fmtFecha = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
};

export default function Ensayos() {
  const nav = useNavigate();
  const [ensayos, setEnsayos] = useState<Ensayo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ensayos")
      .select("id, codigo, nombre, created_at, sedes(nombre)")
      .order("created_at", { ascending: false });
    if (error) { toast.error(dbError(error)); setLoading(false); return; }
    setEnsayos(((data ?? []) as any[]).map((e) => ({
      id: e.id,
      codigo: e.codigo,
      nombre: e.nombre ?? null,
      sede_nombre: e.sedes?.nombre ?? null,
      created_at: e.created_at,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtrados = ensayos.filter((e) => {
    const q = busqueda.toLowerCase();
    return !q || e.codigo.includes(q) || (e.nombre ?? "").toLowerCase().includes(q) || (e.sede_nombre ?? "").toLowerCase().includes(q);
  });

  const entrar = (codigo: string) => {
    localStorage.setItem("ensayo_codigo", codigo);
    nav("/");
  };

  return (
    <Layout title="Historial de ensayos">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Ensayos registrados</h2>
          <p className="text-xs text-muted-foreground">{ensayos.length} ensayos en total</p>
        </div>

        <input
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lapis/40"
          placeholder="Buscar por código, nombre o sede…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-lapis border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {busqueda ? "No se encontraron ensayos" : "Aún no hay ensayos registrados"}
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((e) => (
              <div key={e.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-lapis text-sm">{e.codigo}</span>
                    {e.nombre && (
                      <span className="text-sm font-semibold text-foreground truncate">{e.nombre}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {e.sede_nombre && (
                      <span className="text-xs text-muted-foreground">{e.sede_nombre}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{fmtFecha(e.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => entrar(e.codigo)}
                  className="shrink-0 bg-lapis text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all"
                >
                  Abrir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
