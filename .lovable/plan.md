
# Cambios solicitados

## 1. Orden ascendente en Excel/CSV de Tallos y Ramos

En `src/lib/exportRegistros.ts`:
- En `exportTallos`: ordenar `rows` por `cama`, `parcela`, `tratamiento`, y luego por `numero` ascendente (1, 2, 3...) antes de mapear a filas.
- En `exportRamos`: mismo ordenamiento por `cama`, `parcela`, `tratamiento`, `numero` ascendente.
- `exportProductividad` y `exportPerdidas` no llevan numeración de tallo/ramo, así que se dejan igual (a menos que quieras también un orden específico ahí — avisa).

## 2. Editar los últimos 3 registros en cada sección

En `src/pages/Index.tsx`, en cada una de las 4 tablas de acumulado (Productividad, Pérdidas, Longitud y Botones, Peso de Ramo):

- Agregar un botón **"Editar últimos 3"** al lado del botón **"Limpiar"** existente.
- Al hacer clic, abre un diálogo (`Dialog` de shadcn) que muestra los **3 registros más recientes** del ensayo activo (ordenados por `created_at` desc, limitados a 3).
- Cada fila del diálogo es editable con inputs para:
  - **Productividad**: cama, parcela, tratamiento, ramos, tallos por ramo (la variedad se recalcula automáticamente desde el inventario según la cama; total se recalcula = ramos × tallos por ramo)
  - **Pérdidas**: cama, parcela, tratamiento, causa, tallos (variedad y plantas iniciales se recalculan desde inventario al cambiar cama)
  - **Longitud y Botones**: cama, parcela, tratamiento, longitud_cm, botones (variedad se recalcula)
  - **Peso de Ramo**: cama, parcela, tratamiento, tallos por ramo, peso_g
- Botón **Guardar** por fila (o uno global "Guardar cambios") que hace `UPDATE` en Supabase filtrando por `id` y `ensayo_codigo`.
- Tras guardar, refresca la lista local y cierra el diálogo.

### Cambios técnicos asociados

- Las políticas RLS actuales solo permiten `SELECT`, `INSERT`, `DELETE` (no `UPDATE`). Hay que **crear una migración** que añada políticas `UPDATE` públicas para las tablas: `productividad`, `perdidas`, `tallos`, `ramos_peso`.
- No se modifica el esquema; solo se añaden políticas.

## Resumen de archivos a modificar

```text
supabase/migrations/<nuevo>.sql   → policies UPDATE para 4 tablas
src/lib/exportRegistros.ts        → sort ascendente por numero
src/pages/Index.tsx               → 4 diálogos "Editar últimos 3"
```

## Preguntas antes de implementar

1. ¿Confirmas que el orden ascendente solo se aplica al archivo descargable, no a la tabla en pantalla?
2. En el diálogo de edición, ¿quieres también poder **eliminar** un registro individual, o solo editar?
