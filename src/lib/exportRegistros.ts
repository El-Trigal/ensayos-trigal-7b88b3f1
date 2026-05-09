import * as XLSX from "xlsx";

export type SiembraInfo = {
  bloque: number | null;
  fechaSiembra: string | null;
  variedad: string | null;
  plantas: number | null;
};

export type SiembraRow = {
  bloque: number;
  cm: string;
  fecha: string | null;
  nom_flor: string;
  plantas: number;
};

export const parseCama = (cama: string): { numero: string; lado: string } => {
  const s = (cama ?? "").toString().trim();
  const m = s.match(/^(\d+)\s*([A-Za-z])?$/);
  if (m) return { numero: m[1], lado: (m[2] ?? "").toUpperCase() };
  return { numero: s, lado: "" };
};

export const buildSiembrasMap = (rows: SiembraRow[]): Map<string, SiembraInfo> => {
  const map = new Map<string, SiembraInfo>();
  for (const r of rows) {
    const key = (r.cm ?? "").toString().trim().toUpperCase();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        bloque: r.bloque ?? null,
        fechaSiembra: r.fecha ?? null,
        variedad: r.nom_flor ?? null,
        plantas: r.plantas ?? null,
      });
    }
  }
  return map;
};

export const lookupSiembra = (
  map: Map<string, SiembraInfo>,
  cama: string,
): SiembraInfo => {
  const key = (cama ?? "").toString().trim().toUpperCase();
  if (map.has(key)) return map.get(key)!;
  // Try without lado
  const { numero } = parseCama(cama);
  for (const [k, v] of map) {
    if (k.startsWith(numero)) return v;
  }
  return { bloque: null, fechaSiembra: null, variedad: null, plantas: null };
};

const isoWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

export const getISOWeek = (iso: string | null): number | "" => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return isoWeek(d);
};

export const daysBetween = (a: string | null, b: string | null): number | "" => {
  if (!a || !b) return "";
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return "";
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
};

const fmtDate = (iso: string | null): string => {
  if (!iso) return "";
  return iso.slice(0, 10);
};

const downloadFile = (
  rows: any[][],
  headers: string[],
  fileName: string,
  format: "xlsx" | "csv",
  sheetName: string,
) => {
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }
};

// ===== Productividad =====
export type ProdRow = {
  cama: string; variedad: string; parcela: string; tratamiento: string;
  ramos: number; tallos: number; total: number; fecha: string;
  bloque?: number | null;
};

export const exportProductividad = (
  rows: ProdRow[],
  siembrasMap: Map<string, SiembraInfo>,
  format: "xlsx" | "csv",
) => {
  const headers = [
    "Fecha siembra", "Fecha de corte", "Semana del año", "Días Después de la Siembra",
    "Variedad", "Bloque", "Cama", "Lado", "Parcela", "Tratamiento",
    "Número de Ramos", "Número de tallos por ramo", "Número de tallos",
  ];
  const data = rows.map((r) => {
    const info = lookupSiembra(siembrasMap, r.cama);
    const { numero, lado } = parseCama(r.cama);
    const fechaCorte = fmtDate(r.fecha);
    return [
      info.fechaSiembra ?? "",
      fechaCorte,
      getISOWeek(fechaCorte),
      daysBetween(info.fechaSiembra, fechaCorte),
      r.variedad ?? info.variedad ?? "",
      r.bloque ?? info.bloque ?? "",
      numero,
      lado,
      r.parcela,
      r.tratamiento,
      r.ramos,
      r.tallos,
      r.total,
    ];
  });
  downloadFile(data, headers, "Productividad", format, "Hoja1");
};

// ===== Perdidas =====
export type PerdRow = {
  cama: string; variedad: string; parcela: string; tratamiento: string;
  causa: string; tallos: number; fecha: string;
  bloque?: number | null;
  plantas_iniciales?: number | null;
};

const CAUSAS_EXPORT = [
  "Botón corona", "Botrytis", "Compuesto", "Daño mecanico", "Delgados",
  "Tres puntos", "Flor abierta", "Malformación", "Mezcla", "Mutación",
  "Pocos puntos", "Secadera", "Tallos cortos", "Torcidos", "Vegetativo",
];

// Map causas almacenadas (UI) a columnas de la plantilla
const causaToColumn: Record<string, string> = {
  "Botón corona": "Botón corona",
  "Botrytis": "Botrytis",
  "Compuesto": "Compuesto",
  "Daño mecanico": "Daño mecanico",
  "Delgados": "Delgados",
  "Espiga corta": "Tres puntos",
  "Flor Abierta": "Flor abierta",
  "Malformación": "Malformación",
  "Mezcla": "Mezcla",
  "Mutación": "Mutación",
  "Pocos puntos": "Pocos puntos",
  "Secadera": "Secadera",
  "Tallos cortos": "Tallos cortos",
  "Torcidos": "Torcidos",
  "Vegetativo": "Vegetativo",
};

export const exportPerdidas = (
  perdidas: PerdRow[],
  productividad: ProdRow[],
  siembrasMap: Map<string, SiembraInfo>,
  format: "xlsx" | "csv",
) => {
  const headers = [
    "Fecha siembra", "Fecha corte", "Semana del año", "Variedad", "Bloque",
    "Cama", "Parcela", "Lado", "Tratamiento",
    "# plantas iniciales", "No tallos aprovechados", "No de tallos NO Aprovechados",
    ...CAUSAS_EXPORT,
  ];

  type Group = {
    cama: string; variedad: string; parcela: string; tratamiento: string;
    fechaCorte: string;
    porCausa: Record<string, number>;
    total: number;
    bloque: number | null;
    plantasIni: number | null;
  };
  const groups = new Map<string, Group>();
  for (const p of perdidas) {
    const key = `${p.cama}||${p.variedad}||${p.parcela}||${p.tratamiento}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        cama: p.cama, variedad: p.variedad, parcela: p.parcela, tratamiento: p.tratamiento,
        fechaCorte: fmtDate(p.fecha), porCausa: {}, total: 0,
        bloque: p.bloque ?? null,
        plantasIni: p.plantas_iniciales ?? null,
      };
      groups.set(key, g);
    }
    if (g.bloque == null && p.bloque != null) g.bloque = p.bloque;
    if (g.plantasIni == null && p.plantas_iniciales != null) g.plantasIni = p.plantas_iniciales;
    const col = causaToColumn[p.causa] ?? p.causa;
    g.porCausa[col] = (g.porCausa[col] ?? 0) + p.tallos;
    g.total += p.tallos;
    if (fmtDate(p.fecha) > g.fechaCorte) g.fechaCorte = fmtDate(p.fecha);
  }

  // Aprovechados desde productividad
  const data = Array.from(groups.entries()).map(([_key, g]) => {
    const info = lookupSiembra(siembrasMap, g.cama);
    const { numero, lado } = parseCama(g.cama);
    const plantasIni = g.plantasIni ?? info.plantas ?? null;
    const aprov = plantasIni != null ? plantasIni - g.total : "";
    const row: any[] = [
      info.fechaSiembra ?? "",
      g.fechaCorte,
      getISOWeek(g.fechaCorte),
      g.variedad || info.variedad || "",
      g.bloque ?? info.bloque ?? "",
      numero,
      g.parcela,
      lado,
      g.tratamiento,
      plantasIni ?? "",
      aprov,
      g.total,
    ];
    for (const c of CAUSAS_EXPORT) row.push(g.porCausa[c] ?? 0);
    return row;
  });

  downloadFile(data, headers, "Perdidas", format, "Aprovechamiento");
};

// ===== Tallos (longitud y botones) =====
export type TalloRow = {
  cama: string; parcela: string; tratamiento: string;
  numero: number; longitud_cm: number; botones: number; fecha: string;
  bloque?: number | null;
};

export const exportTallos = (
  rows: TalloRow[],
  siembrasMap: Map<string, SiembraInfo>,
  format: "xlsx" | "csv",
) => {
  const headers = [
    "Fecha siembra", "Fecha de muestreo", "Semana del año", "Días después de la siembra",
    "Variedad", "Bloque", "Cama", "Lado", "Parcela", "Tratamiento",
    "No del Tallo", "Longitud del tallo (cm)", "Número de puntos",
  ];
  const data = rows.map((r) => {
    const info = lookupSiembra(siembrasMap, r.cama);
    const { numero, lado } = parseCama(r.cama);
    const fecha = fmtDate(r.fecha);
    return [
      info.fechaSiembra ?? "",
      fecha,
      getISOWeek(fecha),
      daysBetween(info.fechaSiembra, fecha),
      info.variedad ?? "",
      r.bloque ?? info.bloque ?? "",
      numero,
      lado,
      r.parcela,
      r.tratamiento,
      r.numero,
      r.longitud_cm,
      r.botones,
    ];
  });
  downloadFile(data, headers, "Longitud y Numero de botones", format, "Hoja1");
};

// ===== Ramos peso =====
export type RamoRow = {
  cama: string; parcela: string; tratamiento: string;
  numero: number; tallos_por_ramo: number; peso_g: number; fecha: string;
  bloque?: number | null;
};

export const exportRamos = (
  rows: RamoRow[],
  siembrasMap: Map<string, SiembraInfo>,
  format: "xlsx" | "csv",
) => {
  const headers = [
    "Fecha siembra", "Fecha de muestreo", "Semana del año", "Días después de la siembra",
    "Variedad", "Bloque", "Cama", "Lado", "Parcela", "Tratamiento",
    "No del ramo", "Peso del ramo", "Numero de tallos por ramo", "Peso tallo",
  ];
  const data = rows.map((r) => {
    const info = lookupSiembra(siembrasMap, r.cama);
    const { numero, lado } = parseCama(r.cama);
    const fecha = fmtDate(r.fecha);
    const pesoTallo = r.tallos_por_ramo > 0 ? Number((r.peso_g / r.tallos_por_ramo).toFixed(2)) : "";
    return [
      info.fechaSiembra ?? "",
      fecha,
      getISOWeek(fecha),
      daysBetween(info.fechaSiembra, fecha),
      info.variedad ?? "",
      r.bloque ?? info.bloque ?? "",
      numero,
      lado,
      r.parcela,
      r.tratamiento,
      r.numero,
      r.peso_g,
      r.tallos_por_ramo,
      pesoTallo,
    ];
  });
  downloadFile(data, headers, "Peso del Ramo", format, "Hoja1");
};