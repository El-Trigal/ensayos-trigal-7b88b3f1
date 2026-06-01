import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tipo = "prod" | "perd" | "tallos" | "ramos";

type SiembraLite = { bloque: number; cm: string; nom_flor: string; plantas: number };

const TABLA: Record<Tipo, "productividad" | "perdidas" | "tallos" | "ramos_peso"> = {
  prod: "productividad",
  perd: "perdidas",
  tallos: "tallos",
  ramos: "ramos_peso",
};

const TITULO: Record<Tipo, string> = {
  prod: "Editar últimos 3 registros — Productividad",
  perd: "Editar últimos 3 registros — Pérdidas",
  tallos: "Editar últimos 3 registros — Longitud y botones",
  ramos: "Editar últimos 3 registros — Peso de ramo",
};

const CAUSAS = ["Botón corona", "Botrytis", "Compuesto", "Daño mecanico", "Delgados", "Espiga corta", "Flor Abierta", "Malformación", "Mezcla", "Mutación", "Pocos puntos", "Secadera", "Tallos cortos", "Torcidos", "Vegetativo"];

type Props = {
  open: boolean;
  onClose: () => void;
  tipo: Tipo;
  registros: any[]; // array completo, ya ordenado desc por created_at
  siembras: SiembraLite[];
  onSaved: () => void;
  causasExtra?: string[];
};

export default function EditUltimosDialog({ open, onClose, tipo, registros, siembras, onSaved, causasExtra = [] }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setRows(registros.slice(0, 3).map((r) => ({ ...r })));
  }, [open, registros]);

  const camasUnicas = Array.from(new Set(siembras.map((s) => s.cm))).sort();
  const variedadDe = (cm: string) => siembras.find((s) => s.cm === cm)?.nom_flor ?? "";
  const bloqueDe = (cm: string) => siembras.find((s) => s.cm === cm)?.bloque ?? null;
  const plantasDe = (cm: string) => siembras.find((s) => s.cm === cm)?.plantas ?? null;

  const upd = (i: number, patch: any) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const updCama = (i: number, cm: string) => {
    const variedad = variedadDe(cm);
    const bloque = bloqueDe(cm);
    const patch: any = { cama: cm, variedad, bloque };
    if (tipo === "perd") patch.plantas_iniciales = plantasDe(cm);
    upd(i, patch);
  };

  const eliminar = async (id: string) => {
    if (!window.confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from(TABLA[tipo]).delete().eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Registro eliminado");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const guardar = async () => {
    setSaving(true);
    try {
      for (const r of rows) {
        const payload: any = {
          cama: r.cama,
          parcela: r.parcela,
          tratamiento: r.tratamiento,
          bloque: r.bloque,
        };
        if (tipo === "prod") {
          payload.variedad = r.variedad;
          payload.ramos = Number(r.ramos) || 0;
          payload.tallos_por_ramo = Number(r.tallos_por_ramo ?? r.tallos) || 0;
          payload.total = payload.ramos * payload.tallos_por_ramo;
        } else if (tipo === "perd") {
          payload.variedad = r.variedad;
          payload.causa = r.causa;
          payload.tallos = Number(r.tallos) || 0;
          payload.plantas_iniciales = r.plantas_iniciales;
        } else if (tipo === "tallos") {
          payload.longitud_cm = Number(r.longitud_cm) || 0;
          payload.botones = Number(r.botones) || 0;
          if (r.botones_piso2 == null || r.botones_piso2 === "") {
            payload.piso = null;
            payload.botones_piso2 = null;
          } else {
            payload.piso = "pisos";
            payload.botones_piso2 = Number(r.botones_piso2) || 0;
          }
        } else if (tipo === "ramos") {
          payload.tallos_por_ramo = Number(r.tallos_por_ramo) || 0;
          payload.peso_g = Number(r.peso_g) || 0;
        }
        const { error } = await supabase.from(TABLA[tipo]).update(payload).eq("id", r.id);
        if (error) throw error;
      }
      toast.success("Cambios guardados");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "border border-lapis/30 bg-background px-2 py-1 font-mono text-xs w-full";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase">{TITULO[tipo]}</DialogTitle>
        </DialogHeader>
        {rows.length === 0 ? (
          <div className="font-mono text-xs text-muted-foreground py-6">No hay registros para editar.</div>
        ) : (
          <div className="space-y-4">
            {rows.map((r, i) => (
              <div key={r.id} className="border-2 border-lapis p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">Registro #{i + 1} · {new Date(r.fecha ?? r.created_at).toLocaleString("es")}</div>
                  <button
                    onClick={() => eliminar(r.id)}
                    disabled={deletingId === r.id}
                    className="font-mono text-[10px] uppercase px-2 py-1 border border-red-500 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {deletingId === r.id ? "Eliminando…" : "Eliminar"}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <label className="font-mono text-[10px] uppercase">
                    Cama
                    <select className={inputCls} value={r.cama ?? ""} onChange={(e) => updCama(i, e.target.value)}>
                      <option value="">—</option>
                      {camasUnicas.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  {(tipo === "prod" || tipo === "perd") && (
                    <label className="font-mono text-[10px] uppercase">
                      Variedad
                      <input className={inputCls} value={r.variedad ?? ""} readOnly />
                    </label>
                  )}
                  <label className="font-mono text-[10px] uppercase">
                    Parcela
                    <input className={inputCls} value={r.parcela ?? ""} onChange={(e) => upd(i, { parcela: e.target.value })} />
                  </label>
                  <label className="font-mono text-[10px] uppercase">
                    Tratamiento
                    <input className={inputCls} value={r.tratamiento ?? ""} onChange={(e) => upd(i, { tratamiento: e.target.value })} />
                  </label>
                  {tipo === "prod" && (
                    <>
                      <label className="font-mono text-[10px] uppercase">
                        N° Ramos
                        <input type="number" className={inputCls} value={r.ramos ?? 0} onChange={(e) => upd(i, { ramos: e.target.value })} />
                      </label>
                      <label className="font-mono text-[10px] uppercase">
                        Tallos por ramo
                        <input type="number" className={inputCls} value={r.tallos_por_ramo ?? r.tallos ?? 0} onChange={(e) => upd(i, { tallos_por_ramo: e.target.value, tallos: e.target.value })} />
                      </label>
                    </>
                  )}
                  {tipo === "perd" && (
                    <>
                      <label className="font-mono text-[10px] uppercase">
                        Causa
                        <select className={inputCls} value={r.causa ?? ""} onChange={(e) => upd(i, { causa: e.target.value })}>
                          <option value="">—</option>
                          {[...CAUSAS, ...causasExtra].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                      <label className="font-mono text-[10px] uppercase">
                        Tallos
                        <input type="number" className={inputCls} value={r.tallos ?? 0} onChange={(e) => upd(i, { tallos: e.target.value })} />
                      </label>
                    </>
                  )}
                  {tipo === "tallos" && (
                    <>
                      <label className="font-mono text-[10px] uppercase">
                        Longitud (cm)
                        <input type="number" step="0.1" className={inputCls} value={r.longitud_cm ?? 0} onChange={(e) => upd(i, { longitud_cm: e.target.value })} />
                      </label>
                      <label className="font-mono text-[10px] uppercase">
                        Tipo de registro
                        <select className={inputCls}
                          value={r.botones_piso2 != null ? "pisos" : "sin"}
                          onChange={(e) => {
                            if (e.target.value === "pisos") upd(i, { piso: "pisos", botones_piso2: r.botones_piso2 ?? 0 });
                            else upd(i, { piso: null, botones_piso2: null });
                          }}>
                          <option value="sin">Sin pisos</option>
                          <option value="pisos">Por pisos</option>
                        </select>
                      </label>
                      {r.botones_piso2 == null ? (
                        <label className="font-mono text-[10px] uppercase">
                          N° puntos
                          <input type="number" className={inputCls} value={r.botones ?? 0} onChange={(e) => upd(i, { botones: e.target.value })} />
                        </label>
                      ) : (
                        <>
                          <label className="font-mono text-[10px] uppercase">
                            Puntos piso 1
                            <input type="number" className={inputCls} value={r.botones ?? 0} onChange={(e) => upd(i, { botones: e.target.value })} />
                          </label>
                          <label className="font-mono text-[10px] uppercase">
                            Puntos piso 2
                            <input type="number" className={inputCls} value={r.botones_piso2 ?? 0} onChange={(e) => upd(i, { botones_piso2: e.target.value })} />
                          </label>
                        </>
                      )}
                    </>
                  )}
                  {tipo === "ramos" && (
                    <>
                      <label className="font-mono text-[10px] uppercase">
                        Tallos por ramo
                        <input type="number" className={inputCls} value={r.tallos_por_ramo ?? 0} onChange={(e) => upd(i, { tallos_por_ramo: e.target.value })} />
                      </label>
                      <label className="font-mono text-[10px] uppercase">
                        Peso (g)
                        <input type="number" step="0.1" className={inputCls} value={r.peso_g ?? 0} onChange={(e) => upd(i, { peso_g: e.target.value })} />
                      </label>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <button onClick={onClose} className="font-mono text-xs uppercase px-4 py-2 border-2 border-lapis hover:bg-lapis/10">Cancelar</button>
          <button onClick={guardar} disabled={saving || rows.length === 0} className="font-mono text-xs uppercase px-4 py-2 bg-lapis text-background hover:bg-accent-orange disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}