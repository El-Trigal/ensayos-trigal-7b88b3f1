import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Siembra = {
  id: string;
  bloque: number;
  cm: string;
  semana: string | null;
  fecha: string | null;
  producto: string | null;
  nom_flor: string;
  plantas: number;
};

const parseExcelDate = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // dd/mm/yy o dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
};

const Index = () => {
  const [data, setData] = useState<Siembra[]>([]);
  const [loading, setLoading] = useState(false);
  const [vista, setVista] = useState<"inventario" | "registros">("inventario");
  const [bloque, setBloque] = useState<string>("");
  const [cama, setCama] = useState<string>("");
  const [parcelas, setParcelas] = useState<string>("");
  const [plantasPorParcela, setPlantasPorParcela] = useState<string>("");
  const [parcelaSel, setParcelaSel] = useState<string>("");
  const [tratamiento, setTratamiento] = useState<string>("");
  const [ramos, setRamos] = useState<string>("");
  const [tallosPorRamo, setTallosPorRamo] = useState<string>("");
  const [variedadSel, setVariedadSel] = useState<string>("");
  type Registro = { id: string; cama: string; variedad: string; parcela: string; tratamiento: string; ramos: number; tallos: number; total: number; fecha: string };
  const [registros, setRegistros] = useState<Registro[]>([]);

  // Pérdidas
  const CAUSAS = ["Botón corona", "Botrytis", "Compuesto", "Daño mecanico", "Delgados", "Espiga corta", "Flor Abierta", "Malformación", "Mezcla", "Mutación", "Pocos puntos", "Secadera", "Tallos cortos", "Torcidos", "Vegetativo"] as const;
  const [pVariedadSel, setPVariedadSel] = useState<string>("");
  const [pParcelaSel, setPParcelaSel] = useState<string>("");
  const [pTratamiento, setPTratamiento] = useState<string>("");
  const [pCausa, setPCausa] = useState<string>("");
  const [pTallos, setPTallos] = useState<string>("");
  type Perdida = { id: string; cama: string; variedad: string; parcela: string; tratamiento: string; causa: string; tallos: number; fecha: string };
  const [perdidas, setPerdidas] = useState<Perdida[]>([]);

  const load = async () => {
    const all: Siembra[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("siembras")
        .select("*")
        .order("bloque")
        .range(from, from + pageSize - 1);
      if (error) { toast.error(error.message); return; }
      all.push(...((data ?? []) as Siembra[]));
      if (!data || data.length < pageSize) break;
    }
    setData(all);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("siembras-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "siembras" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const loadRegistros = async () => {
    const [{ data: prod }, { data: perd }] = await Promise.all([
      supabase.from("productividad").select("*").order("created_at", { ascending: false }),
      supabase.from("perdidas").select("*").order("created_at", { ascending: false }),
    ]);
    if (prod) setRegistros(prod.map((r: any) => ({
      id: r.id, cama: r.cama, variedad: r.variedad, parcela: r.parcela,
      tratamiento: r.tratamiento, ramos: r.ramos, tallos: r.tallos_por_ramo,
      total: r.total, fecha: r.created_at,
    })));
    if (perd) setPerdidas(perd.map((r: any) => ({
      id: r.id, cama: r.cama, variedad: r.variedad, parcela: r.parcela,
      tratamiento: r.tratamiento, causa: r.causa, tallos: r.tallos, fecha: r.created_at,
    })));
  };

  useEffect(() => {
    loadRegistros();
    const ch = supabase.channel("registros-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "productividad" }, () => loadRegistros())
      .on("postgres_changes", { event: "*", schema: "public", table: "perdidas" }, () => loadRegistros())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
      if (!rows.length) throw new Error("Archivo vacío");

      const records = rows.map((r) => {
        const norm: any = {};
        Object.keys(r).forEach((k) => { norm[k.toLowerCase().trim()] = r[k]; });
        return {
          bloque: parseInt(String(norm.bloque)),
          cm: String(norm.cm ?? "").trim(),
          semana: norm.semana != null ? String(norm.semana) : null,
          fecha: parseExcelDate(norm.fecha),
          producto: norm.producto ? String(norm.producto) : null,
          nom_flor: String(norm.nom_flor ?? norm["nom flor"] ?? "").trim(),
          plantas: parseInt(String(norm.plantas)) || 0,
        };
      }).filter((r) => !isNaN(r.bloque) && r.cm && r.nom_flor);

      // Insertar por lotes
      const chunkSize = 500;
      for (let i = 0; i < records.length; i += chunkSize) {
        const { error } = await supabase.from("siembras").insert(records.slice(i, i + chunkSize));
        if (error) throw error;
      }
      toast.success(`${records.length} siembras cargadas`);
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  const bloques = useMemo(() => Array.from(new Set(data.map((d) => d.bloque))).sort((a, b) => a - b), [data]);
  const camasDisponibles = useMemo(() => {
    const filtered = bloque ? data.filter((d) => d.bloque === Number(bloque)) : data;
    return Array.from(new Set(filtered.map((d) => d.cm))).sort();
  }, [data, bloque]);

  const filtered = useMemo(() => {
    return data.filter((d) =>
      (!bloque || d.bloque === Number(bloque)) &&
      (!cama || d.cm === cama)
    );
  }, [data, bloque, cama]);

  const variedades = useMemo(() => {
    const m = new Map<string, { plantas: number; siembras: number }>();
    filtered.forEach((r) => {
      const cur = m.get(r.nom_flor) ?? { plantas: 0, siembras: 0 };
      cur.plantas += r.plantas;
      cur.siembras += 1;
      m.set(r.nom_flor, cur);
    });
    return Array.from(m.entries()).map(([nom, v]) => ({ nom, ...v })).sort((a, b) => b.plantas - a.plantas);
  }, [filtered]);

  const totalPlantas = filtered.reduce((a, b) => a + b.plantas, 0);

  const nParcelas = parseInt(parcelas) || 0;
  const nPlantasParc = parseInt(plantasPorParcela) || 0;
  const plantasExperimento = nParcelas * nPlantasParc;
  const efectoBorde = Math.max(totalPlantas - plantasExperimento, 0);

  const nRamos = parseInt(ramos) || 0;
  const nTallos = parseInt(tallosPorRamo) || 0;
  const totalTallos = nRamos * nTallos;

  const acumulados = useMemo(() => {
    const m = new Map<string, { cama: string; variedad: string; parcela: string; tratamiento: string; ramos: number; tallos: number; total: number; n: number }>();
    registros.forEach((r) => {
      const key = `${r.cama}||${r.variedad}||${r.parcela}||${r.tratamiento}`;
      const cur = m.get(key) ?? { cama: r.cama, variedad: r.variedad, parcela: r.parcela, tratamiento: r.tratamiento, ramos: 0, tallos: 0, total: 0, n: 0 };
      cur.ramos += r.ramos;
      cur.tallos += r.tallos;
      cur.total += r.total;
      cur.n += 1;
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) =>
      a.cama.localeCompare(b.cama) || a.variedad.localeCompare(b.variedad) || Number(a.parcela) - Number(b.parcela)
    );
  }, [registros]);

  const añadirRegistro = async () => {
    if (!cama || !variedadSel || !parcelaSel || !tratamiento.trim() || nRamos <= 0 || nTallos <= 0) return;
    const { error } = await supabase.from("productividad").insert({
      cama, variedad: variedadSel, parcela: parcelaSel,
      tratamiento: tratamiento.trim(), ramos: nRamos,
      tallos_por_ramo: nTallos, total: nRamos * nTallos,
    });
    if (error) { toast.error(error.message); return; }
    setRamos(""); setTallosPorRamo("");
    toast.success("Registro añadido");
  };

  const acumuladosPerdidas = useMemo(() => {
    const m = new Map<string, { cama: string; variedad: string; parcela: string; tratamiento: string; causa: string; tallos: number; n: number }>();
    perdidas.forEach((r) => {
      const key = `${r.cama}||${r.variedad}||${r.parcela}||${r.tratamiento}||${r.causa}`;
      const cur = m.get(key) ?? { cama: r.cama, variedad: r.variedad, parcela: r.parcela, tratamiento: r.tratamiento, causa: r.causa, tallos: 0, n: 0 };
      cur.tallos += r.tallos;
      cur.n += 1;
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) =>
      a.cama.localeCompare(b.cama) || a.variedad.localeCompare(b.variedad) || Number(a.parcela) - Number(b.parcela) || a.causa.localeCompare(b.causa)
    );
  }, [perdidas]);

  const añadirPerdida = async () => {
    const t = parseInt(pTallos) || 0;
    if (!cama || !pVariedadSel || !pParcelaSel || !pTratamiento.trim() || !pCausa || t <= 0) return;
    const { error } = await supabase.from("perdidas").insert({
      cama, variedad: pVariedadSel, parcela: pParcelaSel,
      tratamiento: pTratamiento.trim(), causa: pCausa, tallos: t,
    });
    if (error) { toast.error(error.message); return; }
    setPTallos("");
    toast.success("Pérdida registrada");
  };

  const limpiarProductividad = async () => {
    if (!confirm("¿Eliminar TODOS los registros de productividad?")) return;
    const { error } = await supabase.from("productividad").delete().not("id", "is", null);
    if (error) toast.error(error.message);
  };
  const limpiarPerdidas = async () => {
    if (!confirm("¿Eliminar TODOS los registros de pérdidas?")) return;
    const { error } = await supabase.from("perdidas").delete().not("id", "is", null);
    if (error) toast.error(error.message);
  };

  const limpiarTodo = async () => {
    if (!confirm("¿Eliminar TODAS las siembras de la base de datos?")) return;
    const { error } = await supabase.from("siembras").delete().not("id", "is", null);
    if (error) toast.error(error.message); else toast.success("Base de datos limpiada");
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12">
      <nav className="max-w-7xl mx-auto flex flex-wrap gap-4 justify-between items-end border-b-2 border-lapis pb-6 mb-12">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Sistema de Siembras v1.0</span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase text-lapis">DATA_ESTRUCTURA</h1>
        </div>
        <div className="flex gap-6 font-mono text-xs uppercase">
          <span className="text-muted-foreground">Total registros:</span>
          <span className="text-accent-orange">{data.length.toLocaleString("es")}</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto space-y-8">
        <div className="flex gap-2 border-2 border-lapis bg-white p-2">
          <button
            onClick={() => setVista("inventario")}
            className={`flex-1 font-mono text-xs uppercase tracking-widest px-6 py-3 transition-colors ${vista === "inventario" ? "bg-lapis text-background" : "text-lapis hover:bg-accent-orange/10"}`}
          >
            Cargar inventario
          </button>
          <button
            onClick={() => setVista("registros")}
            className={`flex-1 font-mono text-xs uppercase tracking-widest px-6 py-3 transition-colors ${vista === "registros" ? "bg-lapis text-background" : "text-lapis hover:bg-accent-orange/10"}`}
          >
            Registros
          </button>
        </div>

        {vista === "registros" ? (
          <>
            <section className="border-2 border-lapis bg-white">
              <div className="border-b-2 border-lapis p-4 flex justify-between items-center">
                <span className="font-mono text-xs uppercase font-bold text-lapis">Productividad — registros guardados</span>
                {acumulados.length > 0 && (
                  <button onClick={limpiarProductividad} className="font-mono text-xs uppercase text-accent-orange hover:underline">Limpiar</button>
                )}
              </div>
              {acumulados.length === 0 ? (
                <div className="p-8 font-mono text-xs text-muted-foreground">Sin registros aún.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs">
                    <thead className="bg-lapis text-background">
                      <tr>
                        <th className="text-left p-3 uppercase">Cama</th>
                        <th className="text-left p-3 uppercase">Variedad</th>
                        <th className="text-left p-3 uppercase">Parcela</th>
                        <th className="text-left p-3 uppercase">Tratamiento</th>
                        <th className="text-right p-3 uppercase">Registros</th>
                        <th className="text-right p-3 uppercase">Ramos</th>
                        <th className="text-right p-3 uppercase">Total tallos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acumulados.map((a) => (
                        <tr key={`${a.cama}-${a.variedad}-${a.parcela}-${a.tratamiento}`} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                          <td className="p-3 font-bold text-lapis">{a.cama}</td>
                          <td className="p-3 text-lapis">{a.variedad}</td>
                          <td className="p-3 font-bold text-lapis">Parcela {a.parcela}</td>
                          <td className="p-3 text-lapis">{a.tratamiento}</td>
                          <td className="p-3 text-right">{a.n}</td>
                          <td className="p-3 text-right">{a.ramos.toLocaleString("es")}</td>
                          <td className="p-3 text-right text-accent-orange font-bold">{a.total.toLocaleString("es")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="border-2 border-lapis bg-white">
              <div className="border-b-2 border-lapis p-4 flex justify-between items-center">
                <span className="font-mono text-xs uppercase font-bold text-lapis">Pérdidas — registros guardados</span>
                {acumuladosPerdidas.length > 0 && (
                  <button onClick={limpiarPerdidas} className="font-mono text-xs uppercase text-accent-orange hover:underline">Limpiar</button>
                )}
              </div>
              {acumuladosPerdidas.length === 0 ? (
                <div className="p-8 font-mono text-xs text-muted-foreground">Sin registros aún.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs">
                    <thead className="bg-lapis text-background">
                      <tr>
                        <th className="text-left p-3 uppercase">Cama</th>
                        <th className="text-left p-3 uppercase">Variedad</th>
                        <th className="text-left p-3 uppercase">Parcela</th>
                        <th className="text-left p-3 uppercase">Tratamiento</th>
                        <th className="text-left p-3 uppercase">Causa</th>
                        <th className="text-right p-3 uppercase">Registros</th>
                        <th className="text-right p-3 uppercase">Total tallos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acumuladosPerdidas.map((a) => (
                        <tr key={`${a.cama}-${a.variedad}-${a.parcela}-${a.tratamiento}-${a.causa}`} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                          <td className="p-3 font-bold text-lapis">{a.cama}</td>
                          <td className="p-3 text-lapis">{a.variedad}</td>
                          <td className="p-3 font-bold text-lapis">Parcela {a.parcela}</td>
                          <td className="p-3 text-lapis">{a.tratamiento}</td>
                          <td className="p-3 text-lapis">{a.causa}</td>
                          <td className="p-3 text-right">{a.n}</td>
                          <td className="p-3 text-right text-accent-orange font-bold">{a.tallos.toLocaleString("es")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
        <>
        {/* Carga */}
        <section className="border-2 border-lapis bg-white">
          <div className="border-b-2 border-lapis p-4 flex justify-between items-center">
            <span className="font-mono text-xs uppercase font-bold text-lapis">01 // Cargar Inventario de Siembras</span>
            {data.length > 0 && (
              <button onClick={limpiarTodo} className="font-mono text-xs uppercase text-accent-orange hover:underline">
                Limpiar base
              </button>
            )}
          </div>
          <div className="p-8">
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3 block">
                Archivo de siembra (.xlsx) — columnas: bloque, cm, semana, fecha, producto, nom_flor, plantas
              </span>
              <div className="border-2 border-dashed border-lapis hover:border-accent-orange transition-colors p-8 text-center cursor-pointer">
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" id="file-input"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <label htmlFor="file-input" className="cursor-pointer block">
                  <p className="text-xl font-bold tracking-tight text-lapis mb-2">
                    {loading ? "Procesando…" : "Arrastrar o seleccionar archivo"}
                  </p>
                  <span className="font-mono text-xs text-muted-foreground">.xlsx · .xls · .csv</span>
                </label>
              </div>
            </label>
          </div>
        </section>

        {/* Consulta */}
        <section className="border-2 border-lapis bg-white">
          <div className="border-b-2 border-lapis p-4">
            <span className="font-mono text-xs uppercase font-bold text-lapis">02 // Consulta por Bloque y Cama</span>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">Bloque</label>
              <select value={bloque} onChange={(e) => { setBloque(e.target.value); setCama(""); }}
                className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange">
                <option value="">— Todos —</option>
                {bloques.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">Cama (cm)</label>
              <select value={cama} onChange={(e) => setCama(e.target.value)}
                className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange">
                <option value="">— Todas —</option>
                {camasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {(bloque || cama) && variedades.length > 0 && (
            <div className="border-t-2 border-lapis p-8 flex items-start gap-8 bg-white">
              <div className="shrink-0">
                <span className="font-mono text-xs uppercase text-muted-foreground">A // Variedades</span>
                <div className="mt-4 text-5xl font-extrabold tracking-tighter text-lapis">{variedades.length}</div>
              </div>
              <ul className="flex-1 border-l-2 border-lapis pl-6 space-y-1 font-mono text-xs text-lapis max-h-40 overflow-y-auto">
                {variedades.map((v) => (
                  <li key={v.nom} className="flex justify-between gap-4 border-b border-lapis/10 pb-1">
                    <span className="font-bold truncate">{v.nom}</span>
                    <span className="text-accent-orange shrink-0">{v.plantas.toLocaleString("es")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cama && (
            <div className="border-t-2 border-lapis p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-lapis/5">
              <div>
                <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">Parcelas</label>
                <input type="number" min="0" value={parcelas} onChange={(e) => setParcelas(e.target.value)}
                  placeholder="N° de parcelas"
                  className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange" />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">Plantas por parcela</label>
                <input type="number" min="0" value={plantasPorParcela} onChange={(e) => setPlantasPorParcela(e.target.value)}
                  placeholder="Plantas / parcela"
                  className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange" />
              </div>
              {(nParcelas > 0 && nPlantasParc > 0) && (
                <div className="md:col-span-2 grid grid-cols-3 border-2 border-lapis bg-white">
                  <div className="p-6 border-r-2 border-lapis">
                    <span className="font-mono text-xs uppercase text-muted-foreground">Total cama</span>
                    <div className="mt-2 text-3xl font-extrabold tracking-tighter text-lapis">{totalPlantas.toLocaleString("es")}</div>
                  </div>
                  <div className="p-6 border-r-2 border-lapis">
                    <span className="font-mono text-xs uppercase text-muted-foreground">Experimento</span>
                    <div className="mt-2 text-3xl font-extrabold tracking-tighter text-lapis">{plantasExperimento.toLocaleString("es")}</div>
                    <span className="font-mono text-[10px] text-muted-foreground">{nParcelas} × {nPlantasParc}</span>
                  </div>
                  <div className="p-6 bg-accent-orange/10">
                    <span className="font-mono text-xs uppercase text-muted-foreground">Efecto borde</span>
                    <div className="mt-2 text-3xl font-extrabold tracking-tighter text-accent-orange">{efectoBorde.toLocaleString("es")}</div>
                    <span className="font-mono text-[10px] text-muted-foreground">{totalPlantas > 0 ? ((efectoBorde / totalPlantas) * 100).toFixed(1) : 0}% del total</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Productividad */}
        {cama && nParcelas > 0 && (
          <section className="border-2 border-lapis bg-white">
            <div className="border-b-2 border-lapis p-4">
              <span className="font-mono text-xs uppercase font-bold text-lapis">03 // Productividad</span>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">Variedad</label>
                <select value={variedadSel} onChange={(e) => setVariedadSel(e.target.value)}
                  className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange">
                  <option value="">— Selecciona —</option>
                  {variedades.map((v) => <option key={v.nom} value={v.nom}>{v.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">Parcela</label>
                <select value={parcelaSel} onChange={(e) => setParcelaSel(e.target.value)}
                  className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange">
                  <option value="">— Selecciona —</option>
                  {Array.from({ length: nParcelas }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Parcela {n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">Tratamiento</label>
                <input type="text" value={tratamiento} onChange={(e) => setTratamiento(e.target.value)}
                  placeholder="Nombre del tratamiento"
                  className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange" />
              </div>
              {variedadSel && parcelaSel && tratamiento.trim() && (
                <>
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">N° de ramos</label>
                    <input type="number" min="0" value={ramos} onChange={(e) => setRamos(e.target.value)}
                      placeholder="Cantidad de ramos"
                      className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange" />
                  </div>
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">N° de tallos por ramo</label>
                    <input type="number" min="0" value={tallosPorRamo} onChange={(e) => setTallosPorRamo(e.target.value)}
                      placeholder="Tallos / ramo"
                      className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange" />
                  </div>
                  {nRamos > 0 && nTallos > 0 && (
                    <div className="md:col-span-2 border-2 border-lapis bg-accent-orange/10 p-6 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <span className="font-mono text-xs uppercase text-muted-foreground">Tallos en este registro</span>
                        <div className="mt-2 text-4xl font-extrabold tracking-tighter text-accent-orange">{totalTallos.toLocaleString("es")}</div>
                        <span className="font-mono text-[10px] text-muted-foreground">{nRamos} ramos × {nTallos} tallos · Cama {cama} · {variedadSel} · Parcela {parcelaSel} · {tratamiento}</span>
                      </div>
                      <button
                        onClick={añadirRegistro}
                        className="font-mono text-xs uppercase tracking-widest bg-lapis text-background px-6 py-3 hover:bg-accent-orange transition-colors"
                      >
                        Añadir
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            {acumulados.length > 0 && (
              <div className="border-t-2 border-lapis">
                <div className="p-4 border-b-2 border-lapis flex justify-between items-center">
                  <span className="font-mono text-xs uppercase font-bold text-lapis">Acumulado por cama, variedad, parcela y tratamiento</span>
                  <button onClick={limpiarProductividad} className="font-mono text-xs uppercase text-accent-orange hover:underline">
                    Limpiar
                  </button>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead className="bg-lapis text-background">
                    <tr>
                      <th className="text-left p-3 uppercase">Cama</th>
                      <th className="text-left p-3 uppercase">Variedad</th>
                      <th className="text-left p-3 uppercase">Parcela</th>
                      <th className="text-left p-3 uppercase">Tratamiento</th>
                      <th className="text-right p-3 uppercase">Registros</th>
                      <th className="text-right p-3 uppercase">Ramos</th>
                      <th className="text-right p-3 uppercase">Total tallos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acumulados.map((a) => (
                      <tr key={`${a.cama}-${a.variedad}-${a.parcela}-${a.tratamiento}`} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                        <td className="p-3 font-bold text-lapis">{a.cama}</td>
                        <td className="p-3 text-lapis">{a.variedad}</td>
                        <td className="p-3 font-bold text-lapis">Parcela {a.parcela}</td>
                        <td className="p-3 text-lapis">{a.tratamiento}</td>
                        <td className="p-3 text-right">{a.n}</td>
                        <td className="p-3 text-right">{a.ramos.toLocaleString("es")}</td>
                        <td className="p-3 text-right text-accent-orange font-bold">{a.total.toLocaleString("es")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Pérdidas */}
        {cama && nParcelas > 0 && (
          <section className="border-2 border-lapis bg-white">
            <div className="border-b-2 border-lapis p-4">
              <span className="font-mono text-xs uppercase font-bold text-lapis">04 // Pérdidas</span>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">Variedad</label>
                <select value={pVariedadSel} onChange={(e) => setPVariedadSel(e.target.value)}
                  className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange">
                  <option value="">— Selecciona —</option>
                  {variedades.map((v) => <option key={v.nom} value={v.nom}>{v.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">Parcela</label>
                <select value={pParcelaSel} onChange={(e) => setPParcelaSel(e.target.value)}
                  className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange">
                  <option value="">— Selecciona —</option>
                  {Array.from({ length: nParcelas }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Parcela {n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">Tratamiento</label>
                <input type="text" value={pTratamiento} onChange={(e) => setPTratamiento(e.target.value)}
                  placeholder="Nombre del tratamiento"
                  className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange" />
              </div>
              {pVariedadSel && pParcelaSel && pTratamiento.trim() && (
                <>
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">Causa</label>
                    <select value={pCausa} onChange={(e) => setPCausa(e.target.value)}
                      className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange">
                      <option value="">— Selecciona —</option>
                      {CAUSAS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">N° de tallos</label>
                    <input type="number" min="0" value={pTallos} onChange={(e) => setPTallos(e.target.value)}
                      placeholder="Tallos perdidos"
                      className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange" />
                  </div>
                  {pCausa && (parseInt(pTallos) || 0) > 0 && (
                    <div className="md:col-span-2 border-2 border-lapis bg-accent-orange/10 p-6 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <span className="font-mono text-xs uppercase text-muted-foreground">Pérdida en este registro</span>
                        <div className="mt-2 text-4xl font-extrabold tracking-tighter text-accent-orange">{(parseInt(pTallos) || 0).toLocaleString("es")}</div>
                        <span className="font-mono text-[10px] text-muted-foreground">Cama {cama} · {pVariedadSel} · Parcela {pParcelaSel} · {pTratamiento} · {pCausa}</span>
                      </div>
                      <button
                        onClick={añadirPerdida}
                        className="font-mono text-xs uppercase tracking-widest bg-lapis text-background px-6 py-3 hover:bg-accent-orange transition-colors"
                      >
                        Añadir
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            {acumuladosPerdidas.length > 0 && (
              <div className="border-t-2 border-lapis">
                <div className="p-4 border-b-2 border-lapis flex justify-between items-center">
                  <span className="font-mono text-xs uppercase font-bold text-lapis">Acumulado de pérdidas por cama, variedad, parcela, tratamiento y causa</span>
                  <button onClick={limpiarPerdidas} className="font-mono text-xs uppercase text-accent-orange hover:underline">
                    Limpiar
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs">
                    <thead className="bg-lapis text-background">
                      <tr>
                        <th className="text-left p-3 uppercase">Cama</th>
                        <th className="text-left p-3 uppercase">Variedad</th>
                        <th className="text-left p-3 uppercase">Parcela</th>
                        <th className="text-left p-3 uppercase">Tratamiento</th>
                        <th className="text-left p-3 uppercase">Causa</th>
                        <th className="text-right p-3 uppercase">Registros</th>
                        <th className="text-right p-3 uppercase">Total tallos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acumuladosPerdidas.map((a) => (
                        <tr key={`${a.cama}-${a.variedad}-${a.parcela}-${a.tratamiento}-${a.causa}`} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                          <td className="p-3 font-bold text-lapis">{a.cama}</td>
                          <td className="p-3 text-lapis">{a.variedad}</td>
                          <td className="p-3 font-bold text-lapis">Parcela {a.parcela}</td>
                          <td className="p-3 text-lapis">{a.tratamiento}</td>
                          <td className="p-3 text-lapis">{a.causa}</td>
                          <td className="p-3 text-right">{a.n}</td>
                          <td className="p-3 text-right text-accent-orange font-bold">{a.tallos.toLocaleString("es")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Resultados */}
        {filtered.length > 0 ? (
          <>
            <></>
          </>
        ) : (
          <div className="border-2 border-dashed border-lapis/30 p-12 text-center font-mono text-sm text-muted-foreground">
            {data.length === 0 ? "Sin datos. Sube un archivo Excel para comenzar." : "Sin resultados con esos filtros."}
          </div>
        )}
        </>
        )}
      </main>

      <footer className="max-w-7xl mx-auto mt-24 pt-8 border-t-2 border-lapis flex justify-between items-center font-mono text-xs text-muted-foreground">
        <span>DATA_ESTRUCTURA · Siembras en tiempo real</span>
        <span>Lapislázuli Edition</span>
      </footer>
    </div>
  );
};

export default Index;
