## Objetivo

Agregar en cada una de las 4 tablas del apartado **Registros** dos botones: **Descargar Excel** y **Descargar CSV**, generando los archivos con los nombres y estructura de columnas de las plantillas adjuntadas.

## Librería

Instalar `xlsx` (SheetJS) para generar `.xlsx` y `.csv` en el navegador.

## Lógica común para enriquecer columnas

Para llenar las columnas que no están guardadas directamente en cada tabla de registros, antes de exportar se hace un cruce con la tabla `siembras` y se calcula:

- **Cama (número)** y **Lado**: se separa el campo `cama` actual (ej. `57A` → cama=`57`, lado=`A`).
- **Bloque**: se obtiene de `siembras` buscando el bloque cuya cama coincide con el número de cama del registro.
- **Variedad**: para registros donde no esté guardada (ramos_peso), se toma de `siembras` por cama.
- **Fecha siembra**: `siembras.fecha` correspondiente a esa cama/variedad.
- **Fecha de corte / muestreo**: `created_at` del registro (formato `YYYY-MM-DD`).
- **Semana del año**: número ISO de semana de la fecha de corte/muestreo.
- **Días después de la siembra**: diferencia en días entre fecha de corte/muestreo y fecha de siembra.

Se hace un fetch único a `siembras` al cargar la página y se construye un mapa `cama → { bloque, fecha_siembra, variedad }` para los lookups.

## Archivos y columnas

### 1. Productividad.xlsx / .csv
Hoja `Hoja1`, columnas en este orden:
`Fecha siembra | Fecha de corte | Semana del año | Días Después de la Siembra | Variedad | Bloque | Cama | Lado | Parcela | Tratamiento | Número de Ramos | Número de tallos por ramo | Número de tallos`

Una fila por cada registro de `productividad`. `Número de tallos = ramos × tallos_por_ramo`.

### 2. Perdidas.xlsx / .csv
Hoja `Aprovechamiento`, formato pivot:

`Fecha siembra | Fecha corte | Semana del año | Variedad | Bloque | Cama | Parcela | Lado | Tratamiento | # plantas iniciales | No tallos aprovechados | No de tallos NO Aprovechados | Botón corona | Botrytis | Compuesto | Daño mecanico | Delgados | Tres puntos | Flor abierta | Malformación | Mezcla | Mutación | Pocos puntos | Secadera | Tallos cortos | Torcidos | Vegetativo`

- Se agrupa por `cama + variedad + parcela + tratamiento`.
- Cada columna de causa = suma de tallos perdidos de esa causa para el grupo.
- `No de tallos NO Aprovechados` = suma total de tallos perdidos del grupo (todas las causas).
- `No tallos aprovechados` = total de tallos cosechados del mismo grupo en la tabla `productividad` (si existe; si no, vacío).
- `# plantas iniciales` = se toma de `siembras.plantas` para esa cama (si existe; si no, vacío).
- `Fecha corte` = `created_at` más reciente del grupo en `perdidas`.

### 3. Longitud y Numero de botones.xlsx / .csv
Hoja `Hoja1`, una fila por cada registro de `tallos`:

`Fecha siembra | Fecha de muestreo | Semana del año | Días después de la siembra | Variedad | Bloque | Cama | Lado | Parcela | Tratamiento | No del Tallo | Longitud del tallo (cm) | Número de puntos`

`No del Tallo = numero`, `Número de puntos = botones`.

### 4. Peso del Ramo.xlsx / .csv
Hoja `Hoja1`, una fila por cada registro de `ramos_peso`:

`Fecha siembra | Fecha de muestreo | Semana del año | Días después de la siembra | Variedad | Bloque | Cama | Lado | Parcela | Tratamiento | No del ramo | Peso del ramo | Numero de tallos por ramo | Peso tallo`

`Peso tallo = peso_g / tallos_por_ramo` (redondeado a 2 decimales). `Variedad` se obtiene del mapa de siembras por cama.

## UI

En `src/pages/Index.tsx`, dentro de `vista === "registros"`, encima de cada una de las 4 tablas (o en su encabezado), se agregan dos botones pequeños con íconos de descarga:

- `Descargar Excel` → genera `.xlsx`
- `Descargar CSV` → genera `.csv`

Nombres exactos de archivo:
- `Productividad.xlsx` / `Productividad.csv`
- `Perdidas.xlsx` / `Perdidas.csv`
- `Longitud y Numero de botones.xlsx` / `Longitud y Numero de botones.csv`
- `Peso del Ramo.xlsx` / `Peso del Ramo.csv`

Si la tabla está vacía, los botones se deshabilitan.

## Detalles técnicos

- Instalar dependencia: `xlsx`.
- Crear helper `src/lib/exportRegistros.ts` con:
  - `parseCama(cama)` → `{ numero, lado }`
  - `getISOWeek(date)` → número de semana
  - `daysBetween(a, b)` → días
  - `buildSiembrasMap(siembras)` → `Map<camaNumero, { bloque, fechaSiembra, variedad, plantas }>`
  - `exportProductividad(rows, siembrasMap, format)` 
  - `exportPerdidas(rowsPerdidas, rowsProd, siembrasMap, format)`
  - `exportTallos(rows, siembrasMap, format)`
  - `exportRamos(rows, siembrasMap, format)`
- Cargar `siembras` una vez al montar el componente (igual que ya se cargan productividad/perdidas/tallos/ramos).
- Sin cambios en base de datos.

## Archivos modificados

- `package.json` (agregar `xlsx`)
- `src/lib/exportRegistros.ts` (nuevo)
- `src/pages/Index.tsx` (cargar siembras + 8 botones de descarga)
