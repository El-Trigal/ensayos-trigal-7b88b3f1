# Plan de mejoras

## 1. Tratamientos por cama (nuevo modelo)

**Base de datos** — nueva tabla `tratamientos`:
- `id`, `ensayo_codigo`, `cama`, `nombre`, `parcelas` (int), `plantas_por_parcela` (int), `created_at`
- Único por `(ensayo_codigo, cama, nombre)`
- RLS público (igual que el resto), GRANT a anon/authenticated/service_role

**UI inventario** (sección "Cama: configuración"):
- Antes de los inputs actuales (parcelas / plantas por parcela), agregar input **"Tratamiento (nombre)"**
- Botón **"Añadir tratamiento"** que guarda en la tabla
- Lista de tratamientos ya creados para esa cama, con botón eliminar
- Los campos "parcelas" y "plantas por parcela" ahora pertenecen a cada tratamiento (no a la cama global)

## 2. Selectores en secciones de toma de datos

En cada grupo (Productividad, Pérdidas, Longitud, Peso de ramo):
- **Tratamiento**: pasa de input de texto a `<Select>` con tratamientos de la cama seleccionada (filtrados desde la tabla `tratamientos` por `ensayo_codigo` + `cama`)
- **Parcela**: el rango de opciones (1..N) se calcula desde `parcelas` del tratamiento seleccionado, no desde el estado global
- Si la cama no tiene tratamientos, el selector dice "Sin tratamientos para esta cama — créalos en Inventario"

## 3. Grupos dinámicos horizontales (máx 4)

Reemplazar los 3 grupos fijos por:
- Estado inicial: **1 grupo** por sección
- Botón **"+ Crear grupo"** (deshabilitado al llegar a 4) y botón **× eliminar grupo** por tarjeta
- Layout: contenedor con `flex overflow-x-auto snap-x` para scroll horizontal en móvil; cada grupo es una tarjeta de ancho mínimo (~280px) en lugar de apilarse verticalmente
- Aplica a las 4 secciones

## 4. Campo "Piso" en Longitud y puntos

**Base de datos** — agregar columna `piso` (text, nullable) a `tallos`:
- Valores: `null` (sin pisos), `"1"`, `"2"`

**UI** — en cada grupo de Longitud y puntos, agregar `<Select>` "Piso" antes de "Botones":
- Opciones: "Sin pisos", "1", "2"
- Default: "Sin pisos"
- El valor se guarda con el registro (null si "Sin pisos")

## 5. Columna "Piso" en Excel de Longitud y puntos

En `exportTallos`:
- Detectar si algún registro exportado tiene `piso != null`
- Si sí, insertar columna **"Piso"** entre "Longitud del tallo (cm)" y "Número de puntos"
- Si todos son null, no incluirla

## 6. Causas personalizadas por ensayo

**Base de datos** — nueva tabla `causas_personalizadas`:
- `id`, `ensayo_codigo`, `nombre`, `created_at`
- Único por `(ensayo_codigo, nombre)`
- RLS público, GRANT estándar

**UI** — al lado del Select de Causa en cada grupo de Pérdidas:
- Botón **"+ Añadir causa"** que abre un mini-dialog con input + guardar
- Las causas se combinan: las 15 fijas (`CAUSAS`) + las personalizadas del ensayo activo
- Al exportar Excel, las causas personalizadas se incluyen como columnas extra al final

## 7. Anti-duplicados (estado de guardado)

Para cada handler `añadirX`:
- Estado `saving: { [groupIndex: number]: boolean }` por sección (o un Set de claves activas)
- Botón "Añadir" → al click: `setSaving(true)`, disabled, texto cambia a "Guardando…"
- En el `finally` del try/catch: `setSaving(false)`
- Mantener toast de éxito/error existente (ya hay)
- Aplicar también a botones "Añadir tratamiento" y "Añadir causa"

## Detalles técnicos

**Archivos afectados:**
```text
supabase/migrations/<nuevo>.sql       → tabla tratamientos, tabla causas_personalizadas, columna piso en tallos
src/pages/Index.tsx                   → toda la lógica nueva (tratamientos, grupos dinámicos, piso, causas, anti-duplicados)
src/lib/exportRegistros.ts            → columna Piso condicional, columnas de causas personalizadas
src/components/EditUltimosDialog.tsx  → soporte para editar piso en tallos y para nuevas causas
```

**Compatibilidad retro:**
- Registros viejos sin tratamiento en la tabla `tratamientos` siguen funcionando porque el valor `tratamiento` está guardado en cada fila de `productividad`/`perdidas`/`tallos`/`ramos_peso`
- Para usar los nuevos selectores el usuario debe crear tratamientos en Inventario

## Preguntas antes de implementar

1. **Migración de los inputs viejos**: actualmente "Parcelas" y "Plantas por parcela" son globales por cama (un solo valor). ¿Quieres que esos campos desaparezcan de la UI (reemplazados 100% por la lista de tratamientos), o que se mantengan como "valor por defecto" si no hay tratamientos creados?

2. **Causas personalizadas en Excel**: ¿las quieres como columnas adicionales al final (después de "Vegetativo"), o agrupadas en una sola columna "Otras causas"?

3. **Grupos dinámicos**: cuando se elimina un grupo con datos parcialmente llenos, ¿confirmar antes de eliminar, o eliminar directamente?