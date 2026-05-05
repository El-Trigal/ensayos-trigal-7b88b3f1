import { useRef, useState } from "react";
import { parseFile } from "@/lib/parseFile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const UploadZone = () => {
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    setLoading(true);
    try {
      const { columns, rows } = await parseFile(file);
      if (!rows.length) throw new Error("Archivo vacío");
      const { error } = await supabase.from("datasets").insert({
        name: file.name,
        columns: columns as any,
        rows: rows as any,
        row_count: rows.length,
      });
      if (error) throw error;
      toast.success(`${rows.length} registros procesados`);
    } catch (e: any) {
      toast.error(e.message ?? "Error al procesar archivo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files[0]; if (f) handle(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={`group relative border-2 border-dashed border-lapis p-12 cursor-pointer bg-white/50 transition-colors ${drag ? "bg-accent-orange/10 border-accent-orange" : "hover:border-accent-orange"}`}
    >
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <div className="flex flex-col items-center text-center">
        <span className="font-mono text-sm mb-4 text-lapis">[ ARRASTRAR ARCHIVO .CSV / .XLSX ]</span>
        <p className="text-2xl font-bold tracking-tight max-w-md text-balance text-lapis">
          {loading ? "Procesando datos…" : "Suelte su conjunto de datos para iniciar el análisis automático."}
        </p>
        <div className="mt-8 px-6 py-3 bg-lapis text-background font-mono text-xs uppercase tracking-widest group-hover:bg-accent-orange transition-colors">
          {loading ? "Cargando…" : "Seleccionar Archivo Local"}
        </div>
      </div>
    </div>
  );
};
