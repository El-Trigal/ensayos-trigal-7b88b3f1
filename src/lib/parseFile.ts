import * as XLSX from "xlsx";
import Papa from "papaparse";

export type ParsedData = { columns: string[]; rows: Record<string, any>[] };

export async function parseFile(file: File): Promise<ParsedData> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (res) => {
          const rows = res.data as Record<string, any>[];
          const columns = res.meta.fields ?? Object.keys(rows[0] ?? {});
          resolve({ columns, rows });
        },
        error: reject,
      });
    });
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
  const columns = Object.keys(rows[0] ?? {});
  return { columns, rows };
}

export function inferNumericColumns(rows: Record<string, any>[], columns: string[]) {
  return columns.filter((c) => rows.slice(0, 50).every((r) => r[c] === null || r[c] === undefined || r[c] === "" || !isNaN(Number(r[c]))));
}
