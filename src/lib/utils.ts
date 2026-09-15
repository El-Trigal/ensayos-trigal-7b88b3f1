import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TABLA_NOMBRES: Record<string, string> = {
  siembras: "siembras",
  ensayos: "ensayos",
  tratamientos: "tratamientos",
  productividad: "productividad",
  perdidas: "pérdidas",
  tallos: "longitud y puntos",
  ramos_peso: "peso de ramos",
  causas: "causas",
  historial: "historial",
  profiles: "usuarios",
  diametros: "diámetros",
};

export function dbError(err: any): string {
  const msg: string = err?.message ?? String(err ?? "Error desconocido");

  if (/row-level security|rls|403|forbidden/i.test(msg)) {
    const tabla = msg.match(/table\s+"?(\w+)"?/i)?.[1];
    const nombre = tabla ? TABLA_NOMBRES[tabla] ?? tabla : null;
    return nombre
      ? `Sin permiso para modificar ${nombre}. Solo administradores o jefes pueden hacerlo.`
      : "Sin permiso para realizar esta acción. Contacta a un administrador.";
  }
  if (/jwt expired|session.*expired/i.test(msg)) {
    return "Tu sesión expiró. Cierra sesión e ingresa nuevamente.";
  }
  if (/invalid.*jwt|not authenticated/i.test(msg)) {
    return "No estás autenticado. Por favor inicia sesión.";
  }
  if (/unique.*constraint|duplicate key/i.test(msg)) {
    return "Ya existe un registro con esos datos.";
  }
  if (/foreign key/i.test(msg)) {
    return "El registro está vinculado a otros datos y no se puede eliminar.";
  }
  if (/not.null|null value/i.test(msg)) {
    return "Faltan datos obligatorios. Revisa los campos requeridos.";
  }
  if (/could not find.*column/i.test(msg)) {
    const col = msg.match(/find the '(.+?)' column/i)?.[1];
    return col ? `Columna '${col}' no encontrada. Verifica el formato del archivo.` : "Columna no reconocida en el archivo.";
  }
  if (/invalid input syntax/i.test(msg)) {
    return "Formato de datos incorrecto. Revisa el archivo cargado.";
  }
  if (/network|fetch|failed to fetch/i.test(msg)) {
    return "Error de conexión. Revisa tu internet e intenta de nuevo.";
  }
  return msg;
}
