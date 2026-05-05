import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UploadZone } from "@/components/dashboard/UploadZone";
import { StatBlock } from "@/components/dashboard/StatBlock";
import { TrendChart, DistChart, PiePanel } from "@/components/dashboard/Charts";
import { inferNumericColumns } from "@/lib/parseFile";
import { toast } from "sonner";

type Dataset = {
  id: string;
  name: string;
  rows: Record<string, any>[];
  columns: string[];
  row_count: number;
  created_at: string;
};

const Index = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("datasets").select("*").order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => {
        if (data) {
          setDatasets(data as any);
          if (data[0]) setActiveId(data[0].id);
        }
      });
    const channel = supabase.channel("datasets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "datasets" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setDatasets((d) => [payload.new as any, ...d]);
          setActiveId((payload.new as any).id);
        } else if (payload.eventType === "DELETE") {
          setDatasets((d) => d.filter((x) => x.id !== (payload.old as any).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const active = useMemo(() => datasets.find((d) => d.id === activeId), [datasets, activeId]);
  const numericCols = useMemo(() => active ? inferNumericColumns(active.rows, active.columns).filter(Boolean) : [], [active]);
  const catCols = useMemo(() => active ? active.columns.filter((c) => !numericCols.includes(c)) : [], [active, numericCols]);

  const stats = useMemo(() => {
    if (!active) return null;
    const numCol = numericCols[0];
    const values = numCol ? active.rows.map((r) => Number(r[numCol])).filter((v) => !isNaN(v)) : [];
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? sum / values.length : 0;
    return {
      records: active.row_count.toLocaleString("es"),
      cols: active.columns.length,
      numCol,
      sum: numCol ? sum.toLocaleString("es", { maximumFractionDigits: 0 }) : "—",
      avg: numCol ? avg.toLocaleString("es", { maximumFractionDigits: 1 }) : "—",
    };
  }, [active, numericCols]);

  const xKey = catCols[0] ?? active?.columns[0];
  const yKey = numericCols[0];
  const distKey = catCols[0] ?? active?.columns[0];

  const removeDataset = async (id: string) => {
    const { error } = await supabase.from("datasets").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Eliminado");
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12">
      <nav className="max-w-7xl mx-auto flex justify-between items-end border-b-2 border-lapis pb-6 mb-12">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Sistema de Análisis v1.0</span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase text-lapis">DATA_ESTRUCTURA</h1>
        </div>
        <div className="hidden md:flex gap-8 font-mono text-xs uppercase">
          <span className="text-muted-foreground">Estado:</span>
          <span className="text-accent-orange">● Tiempo Real</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto space-y-8">
        <UploadZone />

        {datasets.length > 0 && (
          <div className="border-2 border-lapis bg-white p-4 flex gap-2 overflow-x-auto">
            {datasets.map((d) => (
              <button key={d.id} onClick={() => setActiveId(d.id)}
                className={`shrink-0 px-4 py-2 font-mono text-xs uppercase border-2 border-lapis transition-colors ${activeId === d.id ? "bg-lapis text-background" : "bg-white text-lapis hover:bg-lapis/10"}`}>
                {d.name} <span className="opacity-60">({d.row_count})</span>
                <span onClick={(e) => { e.stopPropagation(); removeDataset(d.id); }} className="ml-3 hover:text-accent-orange">×</span>
              </button>
            ))}
          </div>
        )}

        {active && stats && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 border-2 border-lapis">
              <StatBlock index="01" label="Registros" value={stats.records} />
              <StatBlock index="02" label="Columnas" value={String(stats.cols)} />
              <StatBlock index="03" label={stats.numCol ? `Suma ${stats.numCol}` : "Suma"} value={stats.sum} />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 border-2 border-lapis bg-white">
                <div className="border-b-2 border-lapis p-4 flex justify-between items-center">
                  <span className="font-mono text-xs uppercase font-bold text-lapis">
                    {yKey ? `Tendencia · ${yKey}` : "Sin columnas numéricas"}
                  </span>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-lapis"></div>
                    <div className="w-3 h-3 bg-accent-orange"></div>
                  </div>
                </div>
                <div className="p-4">
                  {xKey && yKey ? <TrendChart rows={active.rows} xKey={xKey} yKey={yKey} /> :
                    <div className="h-[280px] flex items-center justify-center font-mono text-xs text-muted-foreground">No se detectaron columnas numéricas</div>}
                </div>
              </div>

              <aside className="border-2 border-lapis bg-lapis text-background p-6">
                <h3 className="font-mono text-xs uppercase tracking-widest mb-6 border-b border-background/20 pb-2">Esquema Detectado</h3>
                <ul className="space-y-3 font-mono text-xs max-h-[280px] overflow-y-auto">
                  {active.columns.map((c) => (
                    <li key={c} className="flex justify-between gap-3">
                      <span className="text-background/60 truncate">{c}</span>
                      <span className={numericCols.includes(c) ? "text-accent-orange" : ""}>
                        {numericCols.includes(c) ? "NUM" : "STR"}
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="border-2 border-lapis bg-white">
                <div className="border-b-2 border-lapis p-4">
                  <span className="font-mono text-xs uppercase font-bold text-lapis">
                    {distKey ? `Distribución · ${distKey}` : "Distribución"}
                  </span>
                </div>
                <div className="p-4">
                  {distKey && <DistChart rows={active.rows} key1={distKey} />}
                </div>
              </div>
              <div className="border-2 border-lapis bg-white">
                <div className="border-b-2 border-lapis p-4">
                  <span className="font-mono text-xs uppercase font-bold text-lapis">Composición</span>
                </div>
                <div className="p-4">
                  {distKey && <PiePanel rows={active.rows} key1={distKey} />}
                </div>
              </div>
            </section>

            <section className="border-2 border-lapis bg-white overflow-hidden">
              <div className="border-b-2 border-lapis p-4 flex justify-between items-center">
                <span className="font-mono text-xs uppercase font-bold text-lapis">Vista Previa · primeras 20 filas</span>
                <span className="font-mono text-xs text-muted-foreground">{active.row_count.toLocaleString("es")} totales</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead className="bg-lapis text-background">
                    <tr>{active.columns.map((c) => <th key={c} className="text-left p-3 uppercase tracking-tight">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {active.rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-b border-lapis/10 hover:bg-lapis/5">
                        {active.columns.map((c) => <td key={c} className="p-3 truncate max-w-[200px]">{String(r[c] ?? "")}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {!active && (
          <div className="border-2 border-dashed border-lapis/30 p-12 text-center font-mono text-sm text-muted-foreground">
            Aún no hay datos cargados. Suelte un archivo arriba para comenzar.
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto mt-24 pt-8 border-t-2 border-lapis flex justify-between items-center font-mono text-xs text-muted-foreground">
        <span>DATA_ESTRUCTURA · Análisis en tiempo real</span>
        <span>Lapislázuli Edition</span>
      </footer>
    </div>
  );
};

export default Index;
