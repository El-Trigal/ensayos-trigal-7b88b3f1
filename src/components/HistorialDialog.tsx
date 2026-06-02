import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  created_at: string;
  user_nombre: string;
  accion: string;
  tabla: string;
  descripcion: string;
};

const TABLA_LABEL: Record<string, string> = {
  productividad: "Productividad",
  perdidas: "Pérdidas",
  tallos: "Longitud y puntos",
  ramos_peso: "Peso de ramo",
  tratamientos: "Tratamientos",
  siembras: "Siembras",
  causas_personalizadas: "Causas",
  ensayos: "Ensayo",
};
const ACCION_LABEL: Record<string, string> = {
  insert: "Registró",
  update: "Editó",
  delete: "Eliminó",
};
const ACCION_COLOR: Record<string, string> = {
  insert: "text-lapis",
  update: "text-accent-orange",
  delete: "text-red-600",
};

export default function HistorialDialog({ open, onClose, ensayoCodigo }: { open: boolean; onClose: () => void; ensayoCodigo: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(200);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from("historial")
      .select("id, created_at, user_nombre, accion, tabla, descripcion")
      .eq("ensayo_codigo", ensayoCodigo)
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data }) => { setRows((data as Row[]) ?? []); setLoading(false); });
  }, [open, ensayoCodigo, limit]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase">Historial del ensayo {ensayoCodigo}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="font-mono text-xs text-muted-foreground py-6">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="font-mono text-xs text-muted-foreground py-6">Sin movimientos registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs">
              <thead className="bg-lapis text-background sticky top-0">
                <tr>
                  <th className="text-left p-2 uppercase">Fecha</th>
                  <th className="text-left p-2 uppercase">Usuario</th>
                  <th className="text-left p-2 uppercase">Acción</th>
                  <th className="text-left p-2 uppercase">Sección</th>
                  <th className="text-left p-2 uppercase">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-lapis/10">
                    <td className="p-2 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("es")}</td>
                    <td className="p-2 font-bold text-lapis">{r.user_nombre}</td>
                    <td className={`p-2 uppercase font-bold ${ACCION_COLOR[r.accion] ?? "text-lapis"}`}>{ACCION_LABEL[r.accion] ?? r.accion}</td>
                    <td className="p-2 text-lapis">{TABLA_LABEL[r.tabla] ?? r.tabla}</td>
                    <td className="p-2 text-foreground">{r.descripcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === limit && (
              <div className="p-3 text-center">
                <button onClick={() => setLimit((l) => l + 200)} className="font-mono text-xs uppercase px-4 py-2 border-2 border-lapis hover:bg-lapis/10">
                  Cargar más
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}