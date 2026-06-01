import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  buildSiembrasMap,
  exportProductividad,
  exportPerdidas,
  exportTallos,
  exportRamos,
} from "@/lib/exportRegistros";
import EditUltimosDialog from "@/components/EditUltimosDialog";

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

type Tratamiento = {
  id: string;
  cama: string;
  nombre: string;
  parcelas: number;
  plantas_por_parcela: number;
};

type CausaPersonalizada = { id: string; nombre: string };

const parseExcelDate = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
};

const MAX_GRUPOS = 4;

const Index = () => {
  // ===== Ensayo activo =====
  const [ensayoCodigo, setEnsayoCodigo] = useState<string | null>(() => {
    try { return localStorage.getItem("ensayo_codigo"); } catch { return null; }
  });
  const [ensayoModo, setEnsayoModo] = useState<"crear" | "ingresar">("ingresar");
  const [ensayoInput, setEnsayoInput] = useState("");
  const [ensayoLoading, setEnsayoLoading] = useState(false);

  const setEnsayoActivo = (codigo: string | null) => {
    if (codigo) localStorage.setItem("ensayo_codigo", codigo);
    else localStorage.removeItem("ensayo_codigo");
    setEnsayoCodigo(codigo);
  };

  const crearEnsayo = async () => {
    const c = ensayoInput.trim();
    if (!/^\d{5}$/.test(c)) { toast.error("El código debe tener exactamente 5 dígitos numéricos"); return; }
    setEnsayoLoading(true);
    const { data: ex } = await supabase.from("ensayos").select("codigo").eq("codigo", c).maybeSingle();
    if (ex) { setEnsayoLoading(false); toast.error("Ya existe un ensayo con ese código"); return; }
    const { error } = await supabase.from("ensayos").insert({ codigo: c });
    setEnsayoLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Ensayo ${c} creado`);
    setEnsayoInput("");
    setEnsayoActivo(c);
  };

  const ingresarEnsayo = async () => {
    const c = ensayoInput.trim();
    if (!/^\d{5}$/.test(c)) { toast.error("El código debe tener exactamente 5 dígitos numéricos"); return; }
    setEnsayoLoading(true);
    const { data: ex, error } = await supabase.from("ensayos").select("codigo").eq("codigo", c).maybeSingle();
    setEnsayoLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!ex) { toast.error("El ensayo no existe. Verifica el código o crea un nuevo ensayo."); return; }
    setEnsayoInput("");
    setEnsayoActivo(c);
  };

  const salirEnsayo = () => {
    setEnsayoActivo(null);
    setData([]); setRegistros([]); setPerdidas([]); setTallos([]); setRamosPeso([]);
    setTratamientos([]); setCausasPers([]);
  };

  const [data, setData] = useState<Siembra[]>([]);
  const [loading, setLoading] = useState(false);
  const [vista, setVista] = useState<"inventario" | "toma" | "registros">("inventario");
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({ prod: true, perd: false, tallos: false, ramos: false });
  const toggleSec = (k: string) => setOpenSec((p) => ({ ...p, [k]: !p[k] }));
  const [bloque, setBloque] = useState<string>("");
  const [cama, setCama] = useState<string>("");
  const [parcelas, setParcelas] = useState<string>("");
  const [plantasPorParcela, setPlantasPorParcela] = useState<string>("");

  type Registro = { id: string; cama: string; variedad: string; parcela: string; tratamiento: string; ramos: number; tallos: number; total: number; fecha: string; bloque: number | null };
  const [registros, setRegistros] = useState<Registro[]>([]);

  const CAUSAS_FIJAS = ["Botón corona", "Botrytis", "Compuesto", "Daño mecanico", "Delgados", "Espiga corta", "Flor Abierta", "Malformación", "Mezcla", "Mutación", "Pocos puntos", "Secadera", "Tallos cortos", "Torcidos", "Vegetativo"] as const;
  type Perdida = { id: string; cama: string; variedad: string; parcela: string; tratamiento: string; causa: string; tallos: number; fecha: string; bloque: number | null; plantas_iniciales: number | null };
  const [perdidas, setPerdidas] = useState<Perdida[]>([]);

  type Tallo = { id: string; cama: string; parcela: string; tratamiento: string; numero: number; longitud_cm: number; botones: number; botones_piso2: number | null; piso: string | null; fecha: string; bloque: number | null };
  const [tallos, setTallos] = useState<Tallo[]>([]);

  type Ramo = { id: string; cama: string; parcela: string; tratamiento: string; numero: number; tallos_por_ramo: number; peso_g: number; fecha: string; bloque: number | null };
  const [ramosPeso, setRamosPeso] = useState<Ramo[]>([]);

  // Tratamientos / Causas personalizadas
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([]);
  const [causasPers, setCausasPers] = useState<CausaPersonalizada[]>([]);

  // Inputs para crear tratamiento (en sección de cama)
  const [tNombre, setTNombre] = useState("");
  const [tParcelas, setTParcelas] = useState("");
  const [tPlantas, setTPlantas] = useState("");
  const [tratSaving, setTratSaving] = useState(false);

  // Inputs para añadir causa personalizada (por grupo)
  const [nuevaCausaInput, setNuevaCausaInput] = useState<Record<number, string>>({});
  const [causaSaving, setCausaSaving] = useState(false);

  // ===== Grupos dinámicos (1..4) =====
  type ProdGroup = { cama: string; variedad: string; parcela: string; tratamiento: string; ramos: string; tallos: string };
  type PerdGroup = { cama: string; variedad: string; parcela: string; tratamiento: string; causa: string; tallos: string };
  type TallosGroup = { cama: string; parcela: string; tratamiento: string; longitud: string; botones: string; puntos2: string; piso: string };
  type RamosGroup = { cama: string; parcela: string; tratamiento: string; tallosPorRamo: string; peso: string };
  const emptyProd = (): ProdGroup => ({ cama: "", variedad: "", parcela: "", tratamiento: "", ramos: "", tallos: "" });
  const emptyPerd = (): PerdGroup => ({ cama: "", variedad: "", parcela: "", tratamiento: "", causa: "", tallos: "" });
  const emptyTallos = (): TallosGroup => ({ cama: "", parcela: "", tratamiento: "", longitud: "", botones: "", puntos2: "", piso: "sin" });
  const emptyRamos = (): RamosGroup => ({ cama: "", parcela: "", tratamiento: "", tallosPorRamo: "", peso: "" });
  const [prodGroups, setProdGroups] = useState<ProdGroup[]>([emptyProd()]);
  const [perdGroups, setPerdGroups] = useState<PerdGroup[]>([emptyPerd()]);
  const [tallosGroups, setTallosGroups] = useState<TallosGroup[]>([emptyTallos()]);
  const [ramosGroups, setRamosGroups] = useState<RamosGroup[]>([emptyRamos()]);

  // Saving por (sección,index) para evitar doble click
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const isSaving = (k: string) => !!saving[k];
  const setSavingK = (k: string, v: boolean) => setSaving((p) => ({ ...p, [k]: v }));

  const [editTipo, setEditTipo] = useState<null | "prod" | "perd" | "tallos" | "ramos">(null);

  const siembrasMap = useMemo(() => buildSiembrasMap(data as any), [data]);

  const dl = {
    prod: (fmt: "xlsx" | "csv") => exportProductividad(registros as any, siembrasMap, fmt),
    perd: (fmt: "xlsx" | "csv") => exportPerdidas(perdidas as any, registros as any, siembrasMap, fmt),
    tallos: (fmt: "xlsx" | "csv") => exportTallos(tallos as any, siembrasMap, fmt),
    ramos: (fmt: "xlsx" | "csv") => exportRamos(ramosPeso as any, siembrasMap, fmt),
  };

  const load = async () => {
    if (!ensayoCodigo) { setData([]); return; }
    const all: Siembra[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("siembras")
        .select("*")
        .eq("ensayo_codigo", ensayoCodigo)
        .order("bloque")
        .range(from, from + pageSize - 1);
      if (error) { toast.error(error.message); return; }
      all.push(...((data ?? []) as Siembra[]));
      if (!data || data.length < pageSize) break;
    }
    setData(all);
  };

  useEffect(() => {
    if (!ensayoCodigo) return;
    load();
    const ch = supabase.channel("siembras-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "siembras" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ensayoCodigo]);

  const loadTratamientos = async () => {
    if (!ensayoCodigo) { setTratamientos([]); return; }
    const { data, error } = await supabase
      .from("tratamientos")
      .select("*")
      .eq("ensayo_codigo", ensayoCodigo)
      .order("created_at");
    if (error) { toast.error(error.message); return; }
    setTratamientos((data ?? []).map((r: any) => ({
      id: r.id, cama: r.cama, nombre: r.nombre, parcelas: r.parcelas, plantas_por_parcela: r.plantas_por_parcela,
    })));
  };

  const loadCausas = async () => {
    if (!ensayoCodigo) { setCausasPers([]); return; }
    const { data, error } = await supabase
      .from("causas_personalizadas")
      .select("*")
      .eq("ensayo_codigo", ensayoCodigo)
      .order("created_at");
    if (error) { toast.error(error.message); return; }
    setCausasPers((data ?? []).map((r: any) => ({ id: r.id, nombre: r.nombre })));
  };

  useEffect(() => {
    if (!ensayoCodigo) return;
    loadTratamientos();
    loadCausas();
    const ch = supabase.channel("trat-causas-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tratamientos" }, () => loadTratamientos())
      .on("postgres_changes", { event: "*", schema: "public", table: "causas_personalizadas" }, () => loadCausas())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ensayoCodigo]);

  const loadRegistros = async () => {
    if (!ensayoCodigo) {
      setRegistros([]); setPerdidas([]); setTallos([]); setRamosPeso([]); return;
    }
    const [{ data: prod }, { data: perd }, { data: tlls }, { data: rmps }] = await Promise.all([
      supabase.from("productividad").select("*").eq("ensayo_codigo", ensayoCodigo).order("created_at", { ascending: false }),
      supabase.from("perdidas").select("*").eq("ensayo_codigo", ensayoCodigo).order("created_at", { ascending: false }),
      supabase.from("tallos").select("*").eq("ensayo_codigo", ensayoCodigo).order("created_at", { ascending: false }),
      supabase.from("ramos_peso").select("*").eq("ensayo_codigo", ensayoCodigo).order("created_at", { ascending: false }),
    ]);
    if (prod) setRegistros(prod.map((r: any) => ({
      id: r.id, cama: r.cama, variedad: r.variedad, parcela: r.parcela,
      tratamiento: r.tratamiento, ramos: r.ramos, tallos: r.tallos_por_ramo,
      total: r.total, fecha: r.created_at, bloque: r.bloque ?? null,
    })));
    if (perd) setPerdidas(perd.map((r: any) => ({
      id: r.id, cama: r.cama, variedad: r.variedad, parcela: r.parcela,
      tratamiento: r.tratamiento, causa: r.causa, tallos: r.tallos, fecha: r.created_at,
      bloque: r.bloque ?? null, plantas_iniciales: r.plantas_iniciales ?? null,
    })));
    if (tlls) setTallos(tlls.map((r: any) => ({
      id: r.id, cama: r.cama, parcela: r.parcela, tratamiento: r.tratamiento,
      numero: r.numero, longitud_cm: Number(r.longitud_cm), botones: r.botones,
      botones_piso2: r.botones_piso2 ?? null,
      piso: r.piso ?? null, fecha: r.created_at, bloque: r.bloque ?? null,
    })));
    if (rmps) setRamosPeso(rmps.map((r: any) => ({
      id: r.id, cama: r.cama, parcela: r.parcela, tratamiento: r.tratamiento,
      numero: r.numero, tallos_por_ramo: r.tallos_por_ramo, peso_g: Number(r.peso_g), fecha: r.created_at,
      bloque: r.bloque ?? null,
    })));
  };

  useEffect(() => {
    if (!ensayoCodigo) return;
    loadRegistros();
    const ch = supabase.channel("registros-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "productividad" }, () => loadRegistros())
      .on("postgres_changes", { event: "*", schema: "public", table: "perdidas" }, () => loadRegistros())
      .on("postgres_changes", { event: "*", schema: "public", table: "tallos" }, () => loadRegistros())
      .on("postgres_changes", { event: "*", schema: "public", table: "ramos_peso" }, () => loadRegistros())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ensayoCodigo]);

  const handleFile = async (file: File) => {
    if (!ensayoCodigo) return;
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
          ensayo_codigo: ensayoCodigo,
        };
      }).filter((r) => !isNaN(r.bloque) && r.cm && r.nom_flor);

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

  // ===== Helpers para tratamientos y causas =====
  const tratamientosDeCama = (cm: string): Tratamiento[] =>
    tratamientos.filter((t) => t.cama === cm).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const findTratamiento = (cm: string, nombre: string): Tratamiento | undefined =>
    tratamientos.find((t) => t.cama === cm && t.nombre === nombre);

  /** Devuelve cantidad de parcelas a mostrar para una cama + tratamiento dados; fallback al global */
  const parcelasOpciones = (cm: string, tratNombre: string): number => {
    const t = findTratamiento(cm, tratNombre);
    if (t && t.parcelas > 0) return t.parcelas;
    return nParcelas;
  };

  const plantasParaCausaIniciales = (cm: string, tratNombre: string): number | null => {
    const t = findTratamiento(cm, tratNombre);
    if (t && t.plantas_por_parcela > 0) return t.plantas_por_parcela;
    return nPlantasParc > 0 ? nPlantasParc : null;
  };

  const causasDisponibles = useMemo(
    () => [...CAUSAS_FIJAS, ...causasPers.map((c) => c.nombre)],
    [causasPers]
  );

  const variedadesDeCama = (cm: string): string[] => {
    if (!cm) return [];
    const set = new Set<string>();
    data.forEach((d) => { if (d.cm === cm) set.add(d.nom_flor); });
    return Array.from(set).sort();
  };

  // ===== Tratamiento CRUD =====
  const añadirTratamiento = async () => {
    if (!ensayoCodigo || !cama) return;
    const nombre = tNombre.trim();
    const p = parseInt(tParcelas) || 0;
    const pp = parseInt(tPlantas) || 0;
    if (!nombre || p <= 0 || pp <= 0) {
      toast.error("Completa nombre, parcelas y plantas por parcela");
      return;
    }
    if (findTratamiento(cama, nombre)) {
      toast.error("Ya existe un tratamiento con ese nombre en esta cama");
      return;
    }
    setTratSaving(true);
    try {
      const { error } = await supabase.from("tratamientos").insert({
        ensayo_codigo: ensayoCodigo, cama, nombre, parcelas: p, plantas_por_parcela: pp,
      });
      if (error) throw error;
      toast.success(`Tratamiento "${nombre}" creado`);
      setTNombre(""); setTParcelas(""); setTPlantas("");
      loadTratamientos();
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setTratSaving(false);
    }
  };

  const eliminarTratamiento = async (id: string) => {
    if (!confirm("¿Eliminar este tratamiento? Los registros ya guardados no se borrarán.")) return;
    const { error } = await supabase.from("tratamientos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Tratamiento eliminado"); loadTratamientos(); }
  };

  // ===== Causa personalizada CRUD =====
  const añadirCausaPersonalizada = async (groupIdx: number) => {
    if (!ensayoCodigo) return;
    const nombre = (nuevaCausaInput[groupIdx] ?? "").trim();
    if (!nombre) { toast.error("Ingresa el nombre de la causa"); return; }
    if (causasDisponibles.includes(nombre)) { toast.error("Esa causa ya existe"); return; }
    setCausaSaving(true);
    try {
      const { error } = await supabase.from("causas_personalizadas").insert({
        ensayo_codigo: ensayoCodigo, nombre,
      });
      if (error) throw error;
      toast.success(`Causa "${nombre}" creada`);
      setNuevaCausaInput((p) => ({ ...p, [groupIdx]: "" }));
      loadCausas();
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setCausaSaving(false);
    }
  };

  // ===== Grupos: añadir/eliminar =====
  const addGrupo = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, factory: () => T) =>
    setter((p) => p.length >= MAX_GRUPOS ? p : [...p, factory()]);
  const removeGrupo = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number) =>
    setter((p) => p.length <= 1 ? p : p.filter((_, idx) => idx !== i));

  // ===== Acumulados (sin cambios) =====
  const acumulados = useMemo(() => {
    const m = new Map<string, { cama: string; variedad: string; parcela: string; tratamiento: string; ramos: number; tallos: number; total: number; n: number }>();
    registros.forEach((r) => {
      const key = `${r.cama}||${r.variedad}||${r.parcela}||${r.tratamiento}`;
      const cur = m.get(key) ?? { cama: r.cama, variedad: r.variedad, parcela: r.parcela, tratamiento: r.tratamiento, ramos: 0, tallos: 0, total: 0, n: 0 };
      cur.ramos += r.ramos; cur.tallos += r.tallos; cur.total += r.total; cur.n += 1;
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) =>
      a.cama.localeCompare(b.cama) || a.variedad.localeCompare(b.variedad) || Number(a.parcela) - Number(b.parcela)
    );
  }, [registros]);

  const acumuladosPerdidas = useMemo(() => {
    const m = new Map<string, { cama: string; variedad: string; parcela: string; tratamiento: string; causa: string; tallos: number; n: number }>();
    perdidas.forEach((r) => {
      const key = `${r.cama}||${r.variedad}||${r.parcela}||${r.tratamiento}||${r.causa}`;
      const cur = m.get(key) ?? { cama: r.cama, variedad: r.variedad, parcela: r.parcela, tratamiento: r.tratamiento, causa: r.causa, tallos: 0, n: 0 };
      cur.tallos += r.tallos; cur.n += 1;
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) =>
      a.cama.localeCompare(b.cama) || a.variedad.localeCompare(b.variedad) || Number(a.parcela) - Number(b.parcela) || a.causa.localeCompare(b.causa)
    );
  }, [perdidas]);

  const acumuladosTallos = useMemo(() => {
    const m = new Map<string, { cama: string; parcela: string; tratamiento: string; n: number; sumLong: number; sumBot: number }>();
    tallos.forEach((r) => {
      const key = `${r.cama}||${r.parcela}||${r.tratamiento}`;
      const cur = m.get(key) ?? { cama: r.cama, parcela: r.parcela, tratamiento: r.tratamiento, n: 0, sumLong: 0, sumBot: 0 };
      cur.n += 1; cur.sumLong += r.longitud_cm; cur.sumBot += r.botones + (r.botones_piso2 ?? 0);
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) =>
      a.cama.localeCompare(b.cama) || Number(a.parcela) - Number(b.parcela) || a.tratamiento.localeCompare(b.tratamiento)
    );
  }, [tallos]);

  const acumuladosRamos = useMemo(() => {
    const m = new Map<string, { cama: string; parcela: string; tratamiento: string; n: number; sumTallos: number; sumPeso: number }>();
    ramosPeso.forEach((r) => {
      const key = `${r.cama}||${r.parcela}||${r.tratamiento}`;
      const cur = m.get(key) ?? { cama: r.cama, parcela: r.parcela, tratamiento: r.tratamiento, n: 0, sumTallos: 0, sumPeso: 0 };
      cur.n += 1; cur.sumTallos += r.tallos_por_ramo; cur.sumPeso += r.peso_g;
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) =>
      a.cama.localeCompare(b.cama) || Number(a.parcela) - Number(b.parcela) || a.tratamiento.localeCompare(b.tratamiento)
    );
  }, [ramosPeso]);

  const siguienteNumeroTallo = (cm: string, parcela: string, tratamiento: string) => {
    if (!cm || !parcela || !tratamiento.trim()) return 1;
    const t = tratamiento.trim();
    const max = tallos.filter((r) => r.cama === cm && r.parcela === parcela && r.tratamiento === t).reduce((acc, r) => Math.max(acc, r.numero), 0);
    return max + 1;
  };
  const siguienteNumeroRamo = (cm: string, parcela: string, tratamiento: string) => {
    if (!cm || !parcela || !tratamiento.trim()) return 1;
    const t = tratamiento.trim();
    const max = ramosPeso.filter((r) => r.cama === cm && r.parcela === parcela && r.tratamiento === t).reduce((acc, r) => Math.max(acc, r.numero), 0);
    return max + 1;
  };

  // ===== Handlers con guardado seguro =====
  const añadirProdGrupo = async (i: number) => {
    if (!ensayoCodigo) return;
    const key = `prod-${i}`;
    if (isSaving(key)) return;
    const g = prodGroups[i];
    const r = parseInt(g.ramos) || 0;
    const t = parseInt(g.tallos) || 0;
    if (!g.cama || !g.variedad || !g.parcela || !g.tratamiento || r <= 0 || t <= 0) return;
    setSavingK(key, true);
    try {
      const bloqueRow = data.find((d) => d.cm === g.cama)?.bloque ?? null;
      const { error } = await supabase.from("productividad").insert({
        cama: g.cama, variedad: g.variedad, parcela: g.parcela,
        tratamiento: g.tratamiento, ramos: r,
        tallos_por_ramo: t, total: r * t,
        ensayo_codigo: ensayoCodigo, bloque: bloqueRow,
      });
      if (error) throw error;
      setProdGroups((prev) => prev.map((x, idx) => idx === i ? { ...x, ramos: "", tallos: "" } : x));
      toast.success("Dato registrado correctamente");
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSavingK(key, false);
    }
  };

  const añadirPerdGrupo = async (i: number) => {
    if (!ensayoCodigo) return;
    const key = `perd-${i}`;
    if (isSaving(key)) return;
    const g = perdGroups[i];
    const t = parseInt(g.tallos) || 0;
    if (!g.cama || !g.variedad || !g.parcela || !g.tratamiento || !g.causa || t <= 0) return;
    setSavingK(key, true);
    try {
      const bloqueRow = data.find((d) => d.cm === g.cama)?.bloque ?? null;
      const plantasIni = plantasParaCausaIniciales(g.cama, g.tratamiento);
      const { error } = await supabase.from("perdidas").insert({
        cama: g.cama, variedad: g.variedad, parcela: g.parcela,
        tratamiento: g.tratamiento, causa: g.causa, tallos: t,
        ensayo_codigo: ensayoCodigo, bloque: bloqueRow, plantas_iniciales: plantasIni,
      });
      if (error) throw error;
      setPerdGroups((prev) => prev.map((x, idx) => idx === i ? { ...x, tallos: "" } : x));
      toast.success("Pérdida registrada correctamente");
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSavingK(key, false);
    }
  };

  const añadirTalloGrupo = async (i: number) => {
    if (!ensayoCodigo) return;
    const key = `tallos-${i}`;
    if (isSaving(key)) return;
    const g = tallosGroups[i];
    const lon = parseFloat(g.longitud) || 0;
    const bot = parseInt(g.botones);
    const esPisos = g.piso === "pisos";
    const bot2 = parseInt(g.puntos2);
    if (!g.cama || !g.parcela || !g.tratamiento || lon <= 0 || isNaN(bot) || bot < 0) return;
    if (esPisos && (isNaN(bot2) || bot2 < 0)) return;
    setSavingK(key, true);
    try {
      const numero = siguienteNumeroTallo(g.cama, g.parcela, g.tratamiento);
      const bloqueRow = data.find((d) => d.cm === g.cama)?.bloque ?? null;
      const { error } = await supabase.from("tallos").insert({
        cama: g.cama, parcela: g.parcela, tratamiento: g.tratamiento,
        numero, longitud_cm: lon, botones: bot,
        botones_piso2: esPisos ? bot2 : null,
        piso: esPisos ? "pisos" : null,
        ensayo_codigo: ensayoCodigo, bloque: bloqueRow,
      });
      if (error) throw error;
      setTallosGroups((prev) => prev.map((x, idx) => idx === i ? { ...x, longitud: "", botones: "", puntos2: "" } : x));
      toast.success(`Tallo ${numero} registrado`);
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSavingK(key, false);
    }
  };

  const añadirRamoGrupo = async (i: number) => {
    if (!ensayoCodigo) return;
    const key = `ramos-${i}`;
    if (isSaving(key)) return;
    const g = ramosGroups[i];
    const tpr = parseInt(g.tallosPorRamo) || 0;
    const peso = parseFloat(g.peso) || 0;
    if (!g.cama || !g.parcela || !g.tratamiento || tpr <= 0 || peso <= 0) return;
    setSavingK(key, true);
    try {
      const numero = siguienteNumeroRamo(g.cama, g.parcela, g.tratamiento);
      const bloqueRow = data.find((d) => d.cm === g.cama)?.bloque ?? null;
      const { error } = await supabase.from("ramos_peso").insert({
        cama: g.cama, parcela: g.parcela, tratamiento: g.tratamiento,
        numero, tallos_por_ramo: tpr, peso_g: peso,
        ensayo_codigo: ensayoCodigo, bloque: bloqueRow,
      });
      if (error) throw error;
      setRamosGroups((prev) => prev.map((x, idx) => idx === i ? { ...x, tallosPorRamo: "", peso: "" } : x));
      toast.success(`Ramo ${numero} registrado`);
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSavingK(key, false);
    }
  };

  const limpiarProductividad = async () => {
    if (!ensayoCodigo) return;
    if (!confirm("¿Eliminar TODOS los registros de productividad?")) return;
    const { error } = await supabase.from("productividad").delete().eq("ensayo_codigo", ensayoCodigo);
    if (error) toast.error(error.message);
  };
  const limpiarPerdidas = async () => {
    if (!ensayoCodigo) return;
    if (!confirm("¿Eliminar TODOS los registros de pérdidas?")) return;
    const { error } = await supabase.from("perdidas").delete().eq("ensayo_codigo", ensayoCodigo);
    if (error) toast.error(error.message);
  };
  const limpiarTallos = async () => {
    if (!ensayoCodigo) return;
    if (!confirm("¿Eliminar TODOS los registros de longitud y puntos?")) return;
    const { error } = await supabase.from("tallos").delete().eq("ensayo_codigo", ensayoCodigo);
    if (error) toast.error(error.message);
  };
  const limpiarRamos = async () => {
    if (!ensayoCodigo) return;
    if (!confirm("¿Eliminar TODOS los registros de peso de ramo?")) return;
    const { error } = await supabase.from("ramos_peso").delete().eq("ensayo_codigo", ensayoCodigo);
    if (error) toast.error(error.message);
  };
  const limpiarTodo = async () => {
    if (!ensayoCodigo) return;
    if (!confirm("¿Eliminar TODAS las siembras de la base de datos?")) return;
    const { error } = await supabase.from("siembras").delete().eq("ensayo_codigo", ensayoCodigo);
    if (error) toast.error(error.message); else toast.success("Base de datos limpiada");
  };

  // Mostrar las secciones de toma cuando hay siembras cargadas
  const tomaListo = data.length > 0;

  // Clases reutilizables
  const inp = "w-full border-2 border-lapis p-2 bg-background font-mono text-xs focus:outline-none focus:border-accent-orange disabled:opacity-50";
  const btnSec = "w-full font-mono text-xs uppercase tracking-widest bg-lapis text-background px-4 py-2 hover:bg-accent-orange transition-colors disabled:opacity-30 disabled:cursor-not-allowed";
  const groupCard = "border-2 border-lapis p-4 space-y-3 bg-lapis/5 flex-shrink-0 w-[280px] md:w-[300px] snap-start";
  const groupsRow = "p-4 md:p-6 flex gap-4 overflow-x-auto snap-x snap-mandatory";

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12">
      <nav className="max-w-7xl mx-auto flex flex-wrap gap-4 justify-between items-end border-b-2 border-lapis pb-6 mb-12">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Flores el trigal</span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase text-lapis">Aplicativo de ensayos</h1>
        </div>
        {ensayoCodigo && (
          <div className="flex gap-6 items-center font-mono text-xs uppercase">
            <span className="text-muted-foreground">Ensayo:</span>
            <span className="text-accent-orange font-bold">{ensayoCodigo}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Total inventario:</span>
            <span className="text-accent-orange">{data.length.toLocaleString("es")}</span>
            <button onClick={salirEnsayo} className="ml-2 border-2 border-lapis px-3 py-1 text-lapis hover:bg-lapis hover:text-background transition-colors">Salir</button>
          </div>
        )}
      </nav>

      {!ensayoCodigo ? (
        <main className="max-w-xl mx-auto">
          <div className="border-2 border-lapis bg-white">
            <div className="flex border-b-2 border-lapis">
              <button onClick={() => { setEnsayoModo("crear"); setEnsayoInput(""); }}
                className={`flex-1 font-mono text-xs uppercase tracking-widest px-6 py-4 transition-colors ${ensayoModo === "crear" ? "bg-lapis text-background" : "text-lapis hover:bg-accent-orange/10"}`}>
                Crear ensayo
              </button>
              <button onClick={() => { setEnsayoModo("ingresar"); setEnsayoInput(""); }}
                className={`flex-1 font-mono text-xs uppercase tracking-widest px-6 py-4 transition-colors ${ensayoModo === "ingresar" ? "bg-lapis text-background" : "text-lapis hover:bg-accent-orange/10"}`}>
                Ingresar a ensayo
              </button>
            </div>
            <div className="p-8 space-y-4">
              <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground block">
                Código de ensayo (5 dígitos)
              </label>
              <input inputMode="numeric" pattern="\d{5}" maxLength={5} value={ensayoInput}
                onChange={(e) => setEnsayoInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(e) => { if (e.key === "Enter") (ensayoModo === "crear" ? crearEnsayo : ingresarEnsayo)(); }}
                placeholder="12345"
                className="w-full border-2 border-lapis bg-background px-4 py-3 font-mono text-2xl tracking-[0.5em] text-center text-lapis focus:outline-none focus:bg-accent-orange/5" />
              <button onClick={ensayoModo === "crear" ? crearEnsayo : ingresarEnsayo}
                disabled={ensayoLoading || ensayoInput.length !== 5}
                className="w-full bg-lapis text-background font-mono text-xs uppercase tracking-widest px-6 py-3 hover:bg-accent-orange disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                {ensayoLoading ? "..." : ensayoModo === "crear" ? "Crear ensayo" : "Ingresar"}
              </button>
            </div>
          </div>
        </main>
      ) : (
      <main className="max-w-7xl mx-auto space-y-8">
        <div className="flex gap-2 border-2 border-lapis bg-white p-2">
          <button onClick={() => setVista("inventario")}
            className={`flex-1 font-mono text-xs uppercase tracking-widest px-6 py-3 transition-colors ${vista === "inventario" ? "bg-lapis text-background" : "text-lapis hover:bg-accent-orange/10"}`}>
            Cargar inventario
          </button>
          <button onClick={() => setVista("registros")}
            className={`flex-1 font-mono text-xs uppercase tracking-widest px-6 py-3 transition-colors ${vista === "registros" ? "bg-lapis text-background" : "text-lapis hover:bg-accent-orange/10"}`}>
            Registros
          </button>
        </div>

        {vista === "registros" ? (
          <>
            {/* Resumen de registros (tablas existentes) */}
            <section className="border-2 border-lapis bg-white">
              <div className="border-b-2 border-lapis p-4 flex justify-between items-center">
                <span className="font-mono text-xs uppercase font-bold text-lapis">PRODUCTIVIDAD</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => dl.prod("xlsx")} disabled={registros.length === 0} className="font-mono text-xs uppercase text-lapis hover:underline disabled:opacity-30">↓ Excel</button>
                  <button onClick={() => dl.prod("csv")} disabled={registros.length === 0} className="font-mono text-xs uppercase text-lapis hover:underline disabled:opacity-30">↓ CSV</button>
                  {acumulados.length > 0 && <button onClick={limpiarProductividad} className="font-mono text-xs uppercase text-accent-orange hover:underline">Limpiar</button>}
                </div>
              </div>
              {acumulados.length === 0 ? <div className="p-8 font-mono text-xs text-muted-foreground">Sin registros aún.</div> : (
                <div className="overflow-x-auto"><table className="w-full font-mono text-xs">
                  <thead className="bg-lapis text-background"><tr>
                    <th className="text-left p-3 uppercase">Cama</th><th className="text-left p-3 uppercase">Variedad</th>
                    <th className="text-left p-3 uppercase">Parcela</th><th className="text-left p-3 uppercase">Tratamiento</th>
                    <th className="text-right p-3 uppercase">Registros</th><th className="text-right p-3 uppercase">Ramos</th><th className="text-right p-3 uppercase">Total tallos</th>
                  </tr></thead>
                  <tbody>{acumulados.map((a) => (
                    <tr key={`${a.cama}-${a.variedad}-${a.parcela}-${a.tratamiento}`} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                      <td className="p-3 font-bold text-lapis">{a.cama}</td><td className="p-3 text-lapis">{a.variedad}</td>
                      <td className="p-3 font-bold text-lapis">Parcela {a.parcela}</td><td className="p-3 text-lapis">{a.tratamiento}</td>
                      <td className="p-3 text-right">{a.n}</td><td className="p-3 text-right">{a.ramos.toLocaleString("es")}</td>
                      <td className="p-3 text-right text-accent-orange font-bold">{a.total.toLocaleString("es")}</td>
                    </tr>))}</tbody>
                </table></div>
              )}
            </section>

            <section className="border-2 border-lapis bg-white">
              <div className="border-b-2 border-lapis p-4 flex justify-between items-center">
                <span className="font-mono text-xs uppercase font-bold text-lapis">PÉRDIDAS</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => dl.perd("xlsx")} disabled={perdidas.length === 0} className="font-mono text-xs uppercase text-lapis hover:underline disabled:opacity-30">↓ Excel</button>
                  <button onClick={() => dl.perd("csv")} disabled={perdidas.length === 0} className="font-mono text-xs uppercase text-lapis hover:underline disabled:opacity-30">↓ CSV</button>
                  {acumuladosPerdidas.length > 0 && <button onClick={limpiarPerdidas} className="font-mono text-xs uppercase text-accent-orange hover:underline">Limpiar</button>}
                </div>
              </div>
              {acumuladosPerdidas.length === 0 ? <div className="p-8 font-mono text-xs text-muted-foreground">Sin registros aún.</div> : (
                <div className="overflow-x-auto"><table className="w-full font-mono text-xs">
                  <thead className="bg-lapis text-background"><tr>
                    <th className="text-left p-3 uppercase">Cama</th><th className="text-left p-3 uppercase">Variedad</th>
                    <th className="text-left p-3 uppercase">Parcela</th><th className="text-left p-3 uppercase">Tratamiento</th>
                    <th className="text-left p-3 uppercase">Causa</th><th className="text-right p-3 uppercase">Registros</th><th className="text-right p-3 uppercase">Total tallos</th>
                  </tr></thead>
                  <tbody>{acumuladosPerdidas.map((a) => (
                    <tr key={`${a.cama}-${a.variedad}-${a.parcela}-${a.tratamiento}-${a.causa}`} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                      <td className="p-3 font-bold text-lapis">{a.cama}</td><td className="p-3 text-lapis">{a.variedad}</td>
                      <td className="p-3 font-bold text-lapis">Parcela {a.parcela}</td><td className="p-3 text-lapis">{a.tratamiento}</td>
                      <td className="p-3 text-lapis">{a.causa}</td><td className="p-3 text-right">{a.n}</td>
                      <td className="p-3 text-right text-accent-orange font-bold">{a.tallos.toLocaleString("es")}</td>
                    </tr>))}</tbody>
                </table></div>
              )}
            </section>

            <section className="border-2 border-lapis bg-white">
              <div className="border-b-2 border-lapis p-4 flex justify-between items-center">
                <span className="font-mono text-xs uppercase font-bold text-lapis">LONGITUD Y PUNTOS</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => dl.tallos("xlsx")} disabled={tallos.length === 0} className="font-mono text-xs uppercase text-lapis hover:underline disabled:opacity-30">↓ Excel</button>
                  <button onClick={() => dl.tallos("csv")} disabled={tallos.length === 0} className="font-mono text-xs uppercase text-lapis hover:underline disabled:opacity-30">↓ CSV</button>
                  {tallos.length > 0 && <button onClick={limpiarTallos} className="font-mono text-xs uppercase text-accent-orange hover:underline">Limpiar</button>}
                </div>
              </div>
              {tallos.length === 0 ? <div className="p-8 font-mono text-xs text-muted-foreground">Sin registros aún.</div> : (
                <div className="overflow-x-auto"><table className="w-full font-mono text-xs">
                  <thead className="bg-lapis text-background"><tr>
                    <th className="text-left p-3 uppercase">Cama</th><th className="text-left p-3 uppercase">Parcela</th>
                    <th className="text-left p-3 uppercase">Tratamiento</th><th className="text-right p-3 uppercase">Tallo #</th>
                    <th className="text-right p-3 uppercase">Longitud (cm)</th><th className="text-right p-3 uppercase">Puntos</th><th className="text-right p-3 uppercase">Piso 2</th>
                  </tr></thead>
                  <tbody>{[...tallos].sort((a, b) =>
                    a.cama.localeCompare(b.cama) || Number(a.parcela) - Number(b.parcela) ||
                    a.tratamiento.localeCompare(b.tratamiento) || a.numero - b.numero
                  ).map((t) => (
                    <tr key={t.id} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                      <td className="p-3 font-bold text-lapis">{t.cama}</td><td className="p-3 font-bold text-lapis">Parcela {t.parcela}</td>
                      <td className="p-3 text-lapis">{t.tratamiento}</td>
                      <td className="p-3 text-right text-accent-orange font-bold">Tallo {t.numero}</td>
                      <td className="p-3 text-right">{t.longitud_cm}</td>
                      <td className="p-3 text-right">{t.botones}</td>
                      <td className="p-3 text-right">{t.botones_piso2 ?? "—"}</td>
                    </tr>))}</tbody>
                </table></div>
              )}
            </section>

            <section className="border-2 border-lapis bg-white">
              <div className="border-b-2 border-lapis p-4 flex justify-between items-center">
                <span className="font-mono text-xs uppercase font-bold text-lapis">PESO DE RAMO</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => dl.ramos("xlsx")} disabled={ramosPeso.length === 0} className="font-mono text-xs uppercase text-lapis hover:underline disabled:opacity-30">↓ Excel</button>
                  <button onClick={() => dl.ramos("csv")} disabled={ramosPeso.length === 0} className="font-mono text-xs uppercase text-lapis hover:underline disabled:opacity-30">↓ CSV</button>
                  {ramosPeso.length > 0 && <button onClick={limpiarRamos} className="font-mono text-xs uppercase text-accent-orange hover:underline">Limpiar</button>}
                </div>
              </div>
              {ramosPeso.length === 0 ? <div className="p-8 font-mono text-xs text-muted-foreground">Sin registros aún.</div> : (
                <div className="overflow-x-auto"><table className="w-full font-mono text-xs">
                  <thead className="bg-lapis text-background"><tr>
                    <th className="text-left p-3 uppercase">Cama</th><th className="text-left p-3 uppercase">Parcela</th>
                    <th className="text-left p-3 uppercase">Tratamiento</th><th className="text-right p-3 uppercase">Ramo #</th>
                    <th className="text-right p-3 uppercase">Tallos/ramo</th><th className="text-right p-3 uppercase">Peso (g)</th><th className="text-right p-3 uppercase">Peso/tallo (g)</th>
                  </tr></thead>
                  <tbody>{[...ramosPeso].sort((a, b) =>
                    a.cama.localeCompare(b.cama) || Number(a.parcela) - Number(b.parcela) ||
                    a.tratamiento.localeCompare(b.tratamiento) || a.numero - b.numero
                  ).map((r) => (
                    <tr key={r.id} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                      <td className="p-3 font-bold text-lapis">{r.cama}</td><td className="p-3 font-bold text-lapis">Parcela {r.parcela}</td>
                      <td className="p-3 text-lapis">{r.tratamiento}</td>
                      <td className="p-3 text-right text-accent-orange font-bold">Ramo {r.numero}</td>
                      <td className="p-3 text-right">{r.tallos_por_ramo}</td><td className="p-3 text-right">{r.peso_g}</td>
                      <td className="p-3 text-right text-accent-orange font-bold">{r.tallos_por_ramo > 0 ? (r.peso_g / r.tallos_por_ramo).toFixed(2) : "—"}</td>
                    </tr>))}</tbody>
                </table></div>
              )}
            </section>
          </>
        ) : (
        <>
        {/* Carga */}
        <section className="border-2 border-lapis bg-white">
          <div className="border-b-2 border-lapis p-4 flex justify-between items-center">
            <span className="font-mono text-xs uppercase font-bold text-lapis">CARGAR INVENTARIO DE SIEMBRAS</span>
            {data.length > 0 && (
              <button onClick={limpiarTodo} className="font-mono text-xs uppercase text-accent-orange hover:underline">LIMPIAR BASE</button>
            )}
          </div>
          <div className="p-8">
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3 block">
                ARCHIVO DE SIEMBRA (.XLSX) — COLUMNAS: BLOQUE, CM, SEMANA, FECHA, PRODUCTO, NOM_FLOR, PLANTAS
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
            <span className="font-mono text-xs uppercase font-bold text-lapis">CONSULTA POR BLOQUE Y CAMA</span>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">BLOQUE</label>
              <select value={bloque} onChange={(e) => { setBloque(e.target.value); setCama(""); }}
                className="w-full border-2 border-lapis p-3 bg-background font-mono text-sm focus:outline-none focus:border-accent-orange">
                <option value="">— Todos —</option>
                {bloques.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">CAMA (CM)</label>
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
                <span className="font-mono text-xs uppercase text-muted-foreground">A // VARIEDADES</span>
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
            <div className="border-t-2 border-lapis p-8 space-y-6 bg-lapis/5">
              {/* Tratamientos por cama */}
              <div>
                <div className="font-mono text-xs uppercase font-bold text-lapis mb-3">TRATAMIENTOS DE LA CAMA {cama}</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Tratamiento (nombre)</label>
                    <input type="text" value={tNombre} onChange={(e) => setTNombre(e.target.value)}
                      placeholder="Ej: T1" className={inp} />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Parcelas</label>
                    <input type="number" min="0" value={tParcelas} onChange={(e) => setTParcelas(e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Plantas/parcela</label>
                    <input type="number" min="0" value={tPlantas} onChange={(e) => setTPlantas(e.target.value)} className={inp} />
                  </div>
                </div>
                <button onClick={añadirTratamiento} disabled={tratSaving}
                  className="mt-3 font-mono text-xs uppercase tracking-widest bg-lapis text-background px-4 py-2 hover:bg-accent-orange transition-colors disabled:opacity-30">
                  {tratSaving ? "Guardando…" : "+ Añadir tratamiento"}
                </button>
                {tratamientosDeCama(cama).length > 0 && (
                  <ul className="mt-4 space-y-1 font-mono text-xs">
                    {tratamientosDeCama(cama).map((t) => (
                      <li key={t.id} className="flex justify-between items-center border-b border-lapis/10 py-2">
                        <span><span className="font-bold text-lapis">{t.nombre}</span>
                          <span className="text-muted-foreground ml-3">· {t.parcelas} parcelas · {t.plantas_por_parcela} plantas/parcela</span></span>
                        <button onClick={() => eliminarTratamiento(t.id)} className="text-accent-orange hover:underline text-[10px] uppercase">Eliminar</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Globales (fallback) */}
              <div className="border-t-2 border-lapis/30 pt-6">
                <div className="font-mono text-[10px] uppercase text-muted-foreground mb-3">
                  Valores generales (usados si una toma de datos no tiene tratamiento)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">PARCELAS</label>
                    <input type="number" min="0" value={parcelas} onChange={(e) => setParcelas(e.target.value)}
                      placeholder="N° de parcelas" className={inp} />
                  </div>
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-lapis mb-2 block">PLANTAS POR PARCELA</label>
                    <input type="number" min="0" value={plantasPorParcela} onChange={(e) => setPlantasPorParcela(e.target.value)}
                      placeholder="Plantas / parcela" className={inp} />
                  </div>
                </div>
                {(nParcelas > 0 && nPlantasParc > 0) && (
                  <div className="mt-4 grid grid-cols-3 border-2 border-lapis bg-white">
                    <div className="p-6 border-r-2 border-lapis">
                      <span className="font-mono text-xs uppercase text-muted-foreground">TOTAL CAMA</span>
                      <div className="mt-2 text-3xl font-extrabold tracking-tighter text-lapis">{totalPlantas.toLocaleString("es")}</div>
                    </div>
                    <div className="p-6 border-r-2 border-lapis">
                      <span className="font-mono text-xs uppercase text-muted-foreground">EXPERIMENTO</span>
                      <div className="mt-2 text-3xl font-extrabold tracking-tighter text-lapis">{plantasExperimento.toLocaleString("es")}</div>
                      <span className="font-mono text-[10px] text-muted-foreground">{nParcelas} × {nPlantasParc}</span>
                    </div>
                    <div className="p-6 bg-accent-orange/10">
                      <span className="font-mono text-xs uppercase text-muted-foreground">EFECTO BORDE</span>
                      <div className="mt-2 text-3xl font-extrabold tracking-tighter text-accent-orange">{efectoBorde.toLocaleString("es")}</div>
                      <span className="font-mono text-[10px] text-muted-foreground">{totalPlantas > 0 ? ((efectoBorde / totalPlantas) * 100).toFixed(1) : 0}% del total</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ===== PRODUCTIVIDAD ===== */}
        {tomaListo && (
          <section className="border-2 border-lapis bg-white">
            <div className="border-b-2 border-lapis p-4 flex justify-between items-center gap-2 flex-wrap">
              <span className="font-mono text-xs uppercase font-bold text-lapis">PRODUCTIVIDAD · {prodGroups.length} grupo{prodGroups.length > 1 ? "s" : ""}</span>
              <button onClick={() => addGrupo(setProdGroups, emptyProd)} disabled={prodGroups.length >= MAX_GRUPOS}
                className="font-mono text-xs uppercase tracking-widest border-2 border-lapis px-3 py-1 text-lapis hover:bg-lapis hover:text-background disabled:opacity-30">
                + Crear grupo
              </button>
            </div>
            <div className={groupsRow}>
              {prodGroups.map((g, i) => {
                const r = parseInt(g.ramos) || 0;
                const t = parseInt(g.tallos) || 0;
                const valid = g.cama && g.variedad && g.parcela && g.tratamiento && r > 0 && t > 0;
                const trats = tratamientosDeCama(g.cama);
                const nP = parcelasOpciones(g.cama, g.tratamiento);
                const sk = `prod-${i}`;
                return (
                  <div key={i} className={groupCard}>
                    <div className="flex justify-between items-center">
                      <div className="font-mono text-[10px] uppercase font-bold text-lapis">Grupo {i + 1}</div>
                      {prodGroups.length > 1 && (
                        <button onClick={() => removeGrupo(setProdGroups, i)} className="font-mono text-[10px] text-accent-orange hover:underline">× Eliminar</button>
                      )}
                    </div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Cama</label>
                      <select value={g.cama} onChange={(e) => setProdGroups((p) => p.map((x, k) => k === i ? { ...x, cama: e.target.value, variedad: "", tratamiento: "", parcela: "" } : x))} className={inp}>
                        <option value="">—</option>{camasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Variedad</label>
                      <select value={g.variedad} onChange={(e) => setProdGroups((p) => p.map((x, k) => k === i ? { ...x, variedad: e.target.value } : x))} disabled={!g.cama} className={inp}>
                        <option value="">—</option>{variedadesDeCama(g.cama).map((v) => <option key={v} value={v}>{v}</option>)}
                      </select></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Tratamiento</label>
                      <select value={g.tratamiento} onChange={(e) => setProdGroups((p) => p.map((x, k) => k === i ? { ...x, tratamiento: e.target.value, parcela: "" } : x))} disabled={!g.cama} className={inp}>
                        <option value="">—</option>{trats.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                      </select>
                      {g.cama && trats.length === 0 && <span className="font-mono text-[10px] text-muted-foreground">Sin tratamientos. Créalos en Inventario.</span>}
                    </div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Parcela</label>
                      <select value={g.parcela} onChange={(e) => setProdGroups((p) => p.map((x, k) => k === i ? { ...x, parcela: e.target.value } : x))} disabled={nP <= 0} className={inp}>
                        <option value="">—</option>{Array.from({ length: nP }, (_, n) => n + 1).map((n) => <option key={n} value={n}>Parcela {n}</option>)}
                      </select></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Ramos</label>
                        <input type="number" min="0" value={g.ramos} onChange={(e) => setProdGroups((p) => p.map((x, k) => k === i ? { ...x, ramos: e.target.value } : x))} className={inp} /></div>
                      <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Tallos/ramo</label>
                        <input type="number" min="0" value={g.tallos} onChange={(e) => setProdGroups((p) => p.map((x, k) => k === i ? { ...x, tallos: e.target.value } : x))} className={inp} /></div>
                    </div>
                    {valid && <div className="font-mono text-[10px] text-accent-orange">Total: {(r * t).toLocaleString("es")} tallos</div>}
                    <button onClick={() => añadirProdGrupo(i)} disabled={!valid || isSaving(sk)} className={btnSec}>
                      {isSaving(sk) ? "Guardando…" : "Añadir"}
                    </button>
                  </div>
                );
              })}
            </div>
            {acumulados.length > 0 && (
              <div className="border-t-2 border-lapis">
                <div className="p-4 border-b-2 border-lapis flex justify-between items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs uppercase font-bold text-lapis">ACUMULADO POR CAMA, VARIEDAD, PARCELA Y TRATAMIENTO</span>
                  <div className="flex gap-3">
                    <button onClick={() => setEditTipo("prod")} className="font-mono text-xs uppercase text-lapis hover:underline">EDITAR ÚLTIMOS 3</button>
                    <button onClick={limpiarProductividad} className="font-mono text-xs uppercase text-accent-orange hover:underline">LIMPIAR</button>
                  </div>
                </div>
                <div className="overflow-x-auto"><table className="w-full font-mono text-xs">
                  <thead className="bg-lapis text-background"><tr>
                    <th className="text-left p-3 uppercase">Cama</th><th className="text-left p-3 uppercase">Variedad</th>
                    <th className="text-left p-3 uppercase">Parcela</th><th className="text-left p-3 uppercase">Tratamiento</th>
                    <th className="text-right p-3 uppercase">Registros</th><th className="text-right p-3 uppercase">Ramos</th><th className="text-right p-3 uppercase">Total tallos</th>
                  </tr></thead>
                  <tbody>{acumulados.map((a) => (
                    <tr key={`${a.cama}-${a.variedad}-${a.parcela}-${a.tratamiento}`} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                      <td className="p-3 font-bold text-lapis">{a.cama}</td><td className="p-3 text-lapis">{a.variedad}</td>
                      <td className="p-3 font-bold text-lapis">Parcela {a.parcela}</td><td className="p-3 text-lapis">{a.tratamiento}</td>
                      <td className="p-3 text-right">{a.n}</td><td className="p-3 text-right">{a.ramos.toLocaleString("es")}</td>
                      <td className="p-3 text-right text-accent-orange font-bold">{a.total.toLocaleString("es")}</td>
                    </tr>))}</tbody>
                </table></div>
              </div>
            )}
          </section>
        )}

        {/* ===== PÉRDIDAS ===== */}
        {tomaListo && (
          <section className="border-2 border-lapis bg-white">
            <div className="border-b-2 border-lapis p-4 flex justify-between items-center gap-2 flex-wrap">
              <span className="font-mono text-xs uppercase font-bold text-lapis">PÉRDIDAS · {perdGroups.length} grupo{perdGroups.length > 1 ? "s" : ""}</span>
              <button onClick={() => addGrupo(setPerdGroups, emptyPerd)} disabled={perdGroups.length >= MAX_GRUPOS}
                className="font-mono text-xs uppercase tracking-widest border-2 border-lapis px-3 py-1 text-lapis hover:bg-lapis hover:text-background disabled:opacity-30">
                + Crear grupo
              </button>
            </div>
            <div className={groupsRow}>
              {perdGroups.map((g, i) => {
                const t = parseInt(g.tallos) || 0;
                const valid = !!(g.cama && g.variedad && g.parcela && g.tratamiento && g.causa && t > 0);
                const trats = tratamientosDeCama(g.cama);
                const nP = parcelasOpciones(g.cama, g.tratamiento);
                const sk = `perd-${i}`;
                return (
                  <div key={i} className={groupCard}>
                    <div className="flex justify-between items-center">
                      <div className="font-mono text-[10px] uppercase font-bold text-lapis">Grupo {i + 1}</div>
                      {perdGroups.length > 1 && (
                        <button onClick={() => removeGrupo(setPerdGroups, i)} className="font-mono text-[10px] text-accent-orange hover:underline">× Eliminar</button>
                      )}
                    </div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Cama</label>
                      <select value={g.cama} onChange={(e) => setPerdGroups((p) => p.map((x, k) => k === i ? { ...x, cama: e.target.value, variedad: "", tratamiento: "", parcela: "" } : x))} className={inp}>
                        <option value="">—</option>{camasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Variedad</label>
                      <select value={g.variedad} onChange={(e) => setPerdGroups((p) => p.map((x, k) => k === i ? { ...x, variedad: e.target.value } : x))} disabled={!g.cama} className={inp}>
                        <option value="">—</option>{variedadesDeCama(g.cama).map((v) => <option key={v} value={v}>{v}</option>)}
                      </select></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Tratamiento</label>
                      <select value={g.tratamiento} onChange={(e) => setPerdGroups((p) => p.map((x, k) => k === i ? { ...x, tratamiento: e.target.value, parcela: "" } : x))} disabled={!g.cama} className={inp}>
                        <option value="">—</option>{trats.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                      </select></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Parcela</label>
                      <select value={g.parcela} onChange={(e) => setPerdGroups((p) => p.map((x, k) => k === i ? { ...x, parcela: e.target.value } : x))} disabled={nP <= 0} className={inp}>
                        <option value="">—</option>{Array.from({ length: nP }, (_, n) => n + 1).map((n) => <option key={n} value={n}>Parcela {n}</option>)}
                      </select></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Causa</label>
                      <select value={g.causa} onChange={(e) => setPerdGroups((p) => p.map((x, k) => k === i ? { ...x, causa: e.target.value } : x))} className={inp}>
                        <option value="">—</option>{causasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="mt-2 flex gap-1">
                        <input type="text" placeholder="Nueva causa…"
                          value={nuevaCausaInput[i] ?? ""}
                          onChange={(e) => setNuevaCausaInput((p) => ({ ...p, [i]: e.target.value }))}
                          className={inp + " flex-1"} />
                        <button onClick={() => añadirCausaPersonalizada(i)} disabled={causaSaving}
                          className="font-mono text-[10px] uppercase border-2 border-lapis px-2 text-lapis hover:bg-lapis hover:text-background disabled:opacity-30">
                          + Añadir
                        </button>
                      </div>
                    </div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">N° tallos perdidos</label>
                      <input type="number" min="0" value={g.tallos} onChange={(e) => setPerdGroups((p) => p.map((x, k) => k === i ? { ...x, tallos: e.target.value } : x))} className={inp} /></div>
                    <button onClick={() => añadirPerdGrupo(i)} disabled={!valid || isSaving(sk)} className={btnSec}>
                      {isSaving(sk) ? "Guardando…" : "Añadir"}
                    </button>
                  </div>
                );
              })}
            </div>
            {acumuladosPerdidas.length > 0 && (
              <div className="border-t-2 border-lapis">
                <div className="p-4 border-b-2 border-lapis flex justify-between items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs uppercase font-bold text-lapis">ACUMULADO DE PÉRDIDAS POR CAMA, VARIEDAD, PARCELA, TRATAMIENTO Y CAUSA</span>
                  <div className="flex gap-3">
                    <button onClick={() => setEditTipo("perd")} className="font-mono text-xs uppercase text-lapis hover:underline">EDITAR ÚLTIMOS 3</button>
                    <button onClick={limpiarPerdidas} className="font-mono text-xs uppercase text-accent-orange hover:underline">LIMPIAR</button>
                  </div>
                </div>
                <div className="overflow-x-auto"><table className="w-full font-mono text-xs">
                  <thead className="bg-lapis text-background"><tr>
                    <th className="text-left p-3 uppercase">Cama</th><th className="text-left p-3 uppercase">Variedad</th>
                    <th className="text-left p-3 uppercase">Parcela</th><th className="text-left p-3 uppercase">Tratamiento</th>
                    <th className="text-left p-3 uppercase">Causa</th><th className="text-right p-3 uppercase">Registros</th><th className="text-right p-3 uppercase">Total tallos</th>
                  </tr></thead>
                  <tbody>{acumuladosPerdidas.map((a) => (
                    <tr key={`${a.cama}-${a.variedad}-${a.parcela}-${a.tratamiento}-${a.causa}`} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                      <td className="p-3 font-bold text-lapis">{a.cama}</td><td className="p-3 text-lapis">{a.variedad}</td>
                      <td className="p-3 font-bold text-lapis">Parcela {a.parcela}</td><td className="p-3 text-lapis">{a.tratamiento}</td>
                      <td className="p-3 text-lapis">{a.causa}</td><td className="p-3 text-right">{a.n}</td>
                      <td className="p-3 text-right text-accent-orange font-bold">{a.tallos.toLocaleString("es")}</td>
                    </tr>))}</tbody>
                </table></div>
              </div>
            )}
          </section>
        )}

        {/* ===== LONGITUD Y PUNTOS ===== */}
        {tomaListo && (
          <section className="border-2 border-lapis bg-white">
            <div className="border-b-2 border-lapis p-4 flex justify-between items-center gap-2 flex-wrap">
              <span className="font-mono text-xs uppercase font-bold text-lapis">LONGITUD Y PUNTOS · {tallosGroups.length} grupo{tallosGroups.length > 1 ? "s" : ""}</span>
              <button onClick={() => addGrupo(setTallosGroups, emptyTallos)} disabled={tallosGroups.length >= MAX_GRUPOS}
                className="font-mono text-xs uppercase tracking-widest border-2 border-lapis px-3 py-1 text-lapis hover:bg-lapis hover:text-background disabled:opacity-30">
                + Crear grupo
              </button>
            </div>
            <div className={groupsRow}>
              {tallosGroups.map((g, i) => {
                const lon = parseFloat(g.longitud) || 0;
                const bot = parseInt(g.botones);
                const bot2 = parseInt(g.puntos2);
                const validBase = !!(g.cama && g.parcela && g.tratamiento && lon > 0 && !isNaN(bot) && bot >= 0);
                const valid = g.piso === "pisos" ? (validBase && !isNaN(bot2) && bot2 >= 0) : validBase;
                const num = siguienteNumeroTallo(g.cama, g.parcela, g.tratamiento);
                const trats = tratamientosDeCama(g.cama);
                const nP = parcelasOpciones(g.cama, g.tratamiento);
                const sk = `tallos-${i}`;
                return (
                  <div key={i} className={groupCard}>
                    <div className="flex justify-between items-center">
                      <div className="font-mono text-[10px] uppercase font-bold text-lapis">Grupo {i + 1} · Tallo {num}</div>
                      {tallosGroups.length > 1 && (
                        <button onClick={() => removeGrupo(setTallosGroups, i)} className="font-mono text-[10px] text-accent-orange hover:underline">× Eliminar</button>
                      )}
                    </div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Cama</label>
                      <select value={g.cama} onChange={(e) => setTallosGroups((p) => p.map((x, k) => k === i ? { ...x, cama: e.target.value, tratamiento: "", parcela: "" } : x))} className={inp}>
                        <option value="">—</option>{camasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Tratamiento</label>
                      <select value={g.tratamiento} onChange={(e) => setTallosGroups((p) => p.map((x, k) => k === i ? { ...x, tratamiento: e.target.value, parcela: "" } : x))} disabled={!g.cama} className={inp}>
                        <option value="">—</option>{trats.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                      </select></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Parcela</label>
                      <select value={g.parcela} onChange={(e) => setTallosGroups((p) => p.map((x, k) => k === i ? { ...x, parcela: e.target.value } : x))} disabled={nP <= 0} className={inp}>
                        <option value="">—</option>{Array.from({ length: nP }, (_, n) => n + 1).map((n) => <option key={n} value={n}>Parcela {n}</option>)}
                      </select></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Longitud (cm)</label>
                      <input type="number" min="0" step="0.1" value={g.longitud} onChange={(e) => setTallosGroups((p) => p.map((x, k) => k === i ? { ...x, longitud: e.target.value } : x))} className={inp} /></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Tipo de registro</label>
                      <select value={g.piso} onChange={(e) => setTallosGroups((p) => p.map((x, k) => k === i ? { ...x, piso: e.target.value, puntos2: e.target.value === "sin" ? "" : x.puntos2 } : x))} className={inp}>
                        <option value="sin">Sin pisos</option>
                        <option value="pisos">Por pisos</option>
                      </select></div>
                    {g.piso === "sin" ? (
                      <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">N° puntos florales</label>
                        <input type="number" min="0" value={g.botones} onChange={(e) => setTallosGroups((p) => p.map((x, k) => k === i ? { ...x, botones: e.target.value } : x))} className={inp} /></div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Puntos piso 1</label>
                          <input type="number" min="0" value={g.botones} onChange={(e) => setTallosGroups((p) => p.map((x, k) => k === i ? { ...x, botones: e.target.value } : x))} className={inp} /></div>
                        <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Puntos piso 2</label>
                          <input type="number" min="0" value={g.puntos2} onChange={(e) => setTallosGroups((p) => p.map((x, k) => k === i ? { ...x, puntos2: e.target.value } : x))} className={inp} /></div>
                      </div>
                    )}
                    <button onClick={() => añadirTalloGrupo(i)} disabled={!valid || isSaving(sk)} className={btnSec}>
                      {isSaving(sk) ? "Guardando…" : "Añadir"}
                    </button>
                  </div>
                );
              })}
            </div>
            {acumuladosTallos.length > 0 && (
              <div className="border-t-2 border-lapis">
                <div className="p-4 border-b-2 border-lapis flex justify-between items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs uppercase font-bold text-lapis">ACUMULADO POR CAMA, PARCELA Y TRATAMIENTO</span>
                  <div className="flex gap-3">
                    <button onClick={() => setEditTipo("tallos")} className="font-mono text-xs uppercase text-lapis hover:underline">EDITAR ÚLTIMOS 3</button>
                    <button onClick={limpiarTallos} className="font-mono text-xs uppercase text-accent-orange hover:underline">LIMPIAR</button>
                  </div>
                </div>
                <div className="overflow-x-auto"><table className="w-full font-mono text-xs">
                  <thead className="bg-lapis text-background"><tr>
                    <th className="text-left p-3 uppercase">Cama</th><th className="text-left p-3 uppercase">Parcela</th>
                    <th className="text-left p-3 uppercase">Tratamiento</th><th className="text-right p-3 uppercase">N° tallos</th>
                    <th className="text-right p-3 uppercase">Prom. longitud (cm)</th><th className="text-right p-3 uppercase">Prom. botones</th>
                  </tr></thead>
                  <tbody>{acumuladosTallos.map((a) => (
                    <tr key={`${a.cama}-${a.parcela}-${a.tratamiento}`} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                      <td className="p-3 font-bold text-lapis">{a.cama}</td><td className="p-3 font-bold text-lapis">Parcela {a.parcela}</td>
                      <td className="p-3 text-lapis">{a.tratamiento}</td>
                      <td className="p-3 text-right text-accent-orange font-bold">{a.n}</td>
                      <td className="p-3 text-right">{(a.sumLong / a.n).toFixed(1)}</td><td className="p-3 text-right">{(a.sumBot / a.n).toFixed(1)}</td>
                    </tr>))}</tbody>
                </table></div>
              </div>
            )}
          </section>
        )}

        {/* ===== PESO DE RAMO ===== */}
        {tomaListo && (
          <section className="border-2 border-lapis bg-white">
            <div className="border-b-2 border-lapis p-4 flex justify-between items-center gap-2 flex-wrap">
              <span className="font-mono text-xs uppercase font-bold text-lapis">PESO DE RAMO · {ramosGroups.length} grupo{ramosGroups.length > 1 ? "s" : ""}</span>
              <button onClick={() => addGrupo(setRamosGroups, emptyRamos)} disabled={ramosGroups.length >= MAX_GRUPOS}
                className="font-mono text-xs uppercase tracking-widest border-2 border-lapis px-3 py-1 text-lapis hover:bg-lapis hover:text-background disabled:opacity-30">
                + Crear grupo
              </button>
            </div>
            <div className={groupsRow}>
              {ramosGroups.map((g, i) => {
                const tpr = parseInt(g.tallosPorRamo) || 0;
                const peso = parseFloat(g.peso) || 0;
                const valid = !!(g.cama && g.parcela && g.tratamiento && tpr > 0 && peso > 0);
                const num = siguienteNumeroRamo(g.cama, g.parcela, g.tratamiento);
                const trats = tratamientosDeCama(g.cama);
                const nP = parcelasOpciones(g.cama, g.tratamiento);
                const sk = `ramos-${i}`;
                return (
                  <div key={i} className={groupCard}>
                    <div className="flex justify-between items-center">
                      <div className="font-mono text-[10px] uppercase font-bold text-lapis">Grupo {i + 1} · Ramo {num}</div>
                      {ramosGroups.length > 1 && (
                        <button onClick={() => removeGrupo(setRamosGroups, i)} className="font-mono text-[10px] text-accent-orange hover:underline">× Eliminar</button>
                      )}
                    </div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Cama</label>
                      <select value={g.cama} onChange={(e) => setRamosGroups((p) => p.map((x, k) => k === i ? { ...x, cama: e.target.value, tratamiento: "", parcela: "" } : x))} className={inp}>
                        <option value="">—</option>{camasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Tratamiento</label>
                      <select value={g.tratamiento} onChange={(e) => setRamosGroups((p) => p.map((x, k) => k === i ? { ...x, tratamiento: e.target.value, parcela: "" } : x))} disabled={!g.cama} className={inp}>
                        <option value="">—</option>{trats.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                      </select></div>
                    <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Parcela</label>
                      <select value={g.parcela} onChange={(e) => setRamosGroups((p) => p.map((x, k) => k === i ? { ...x, parcela: e.target.value } : x))} disabled={nP <= 0} className={inp}>
                        <option value="">—</option>{Array.from({ length: nP }, (_, n) => n + 1).map((n) => <option key={n} value={n}>Parcela {n}</option>)}
                      </select></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Tallos/ramo</label>
                        <input type="number" min="0" value={g.tallosPorRamo} onChange={(e) => setRamosGroups((p) => p.map((x, k) => k === i ? { ...x, tallosPorRamo: e.target.value } : x))} className={inp} /></div>
                      <div><label className="font-mono text-[10px] uppercase text-lapis mb-1 block">Peso (g)</label>
                        <input type="number" min="0" step="0.1" value={g.peso} onChange={(e) => setRamosGroups((p) => p.map((x, k) => k === i ? { ...x, peso: e.target.value } : x))} className={inp} /></div>
                    </div>
                    {valid && <div className="font-mono text-[10px] text-accent-orange">Peso/tallo: {(peso / tpr).toFixed(2)} g</div>}
                    <button onClick={() => añadirRamoGrupo(i)} disabled={!valid || isSaving(sk)} className={btnSec}>
                      {isSaving(sk) ? "Guardando…" : "Añadir"}
                    </button>
                  </div>
                );
              })}
            </div>
            {acumuladosRamos.length > 0 && (
              <div className="border-t-2 border-lapis">
                <div className="p-4 border-b-2 border-lapis flex justify-between items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs uppercase font-bold text-lapis">ACUMULADO POR CAMA, PARCELA Y TRATAMIENTO</span>
                  <div className="flex gap-3">
                    <button onClick={() => setEditTipo("ramos")} className="font-mono text-xs uppercase text-lapis hover:underline">EDITAR ÚLTIMOS 3</button>
                    <button onClick={limpiarRamos} className="font-mono text-xs uppercase text-accent-orange hover:underline">LIMPIAR</button>
                  </div>
                </div>
                <div className="overflow-x-auto"><table className="w-full font-mono text-xs">
                  <thead className="bg-lapis text-background"><tr>
                    <th className="text-left p-3 uppercase">Cama</th><th className="text-left p-3 uppercase">Parcela</th>
                    <th className="text-left p-3 uppercase">Tratamiento</th><th className="text-right p-3 uppercase">N° ramos</th>
                    <th className="text-right p-3 uppercase">Total tallos</th><th className="text-right p-3 uppercase">Peso total (g)</th><th className="text-right p-3 uppercase">Peso/tallo (g)</th>
                  </tr></thead>
                  <tbody>{acumuladosRamos.map((a) => (
                    <tr key={`${a.cama}-${a.parcela}-${a.tratamiento}`} className="border-b border-lapis/10 hover:bg-accent-orange/10">
                      <td className="p-3 font-bold text-lapis">{a.cama}</td><td className="p-3 font-bold text-lapis">Parcela {a.parcela}</td>
                      <td className="p-3 text-lapis">{a.tratamiento}</td>
                      <td className="p-3 text-right text-accent-orange font-bold">{a.n}</td>
                      <td className="p-3 text-right">{a.sumTallos}</td><td className="p-3 text-right">{a.sumPeso.toFixed(1)}</td>
                      <td className="p-3 text-right text-accent-orange font-bold">{a.sumTallos > 0 ? (a.sumPeso / a.sumTallos).toFixed(2) : "—"}</td>
                    </tr>))}</tbody>
                </table></div>
              </div>
            )}
          </section>
        )}

        {data.length === 0 && (
          <div className="border-2 border-dashed border-lapis/30 p-12 text-center font-mono text-sm text-muted-foreground">
            Sin datos. Sube un archivo Excel para comenzar.
          </div>
        )}
        </>
        )}
      </main>
      )}

      <footer className="max-w-7xl mx-auto mt-24 pt-8 border-t-2 border-lapis flex justify-between items-center font-mono text-xs text-muted-foreground">
        <span>Aplicativo de ensayos v 1.0</span>
        <span>Innovación Flores el Trigal</span>
      </footer>

      {editTipo && (
        <EditUltimosDialog
          open={!!editTipo}
          onClose={() => setEditTipo(null)}
          tipo={editTipo}
          registros={
            editTipo === "prod" ? registros :
            editTipo === "perd" ? perdidas :
            editTipo === "tallos" ? tallos :
            ramosPeso
          }
          siembras={data}
          causasExtra={causasPers.map((c) => c.nombre)}
          onSaved={() => loadRegistros()}
        />
      )}
    </div>
  );
};

export default Index;
