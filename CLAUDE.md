# Aplicativo de Ensayos — Flores el Trigal

App web para gestión de ensayos agronómicos en una finca de flores de corte.

## Stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** con tokens custom (`lapis`, `accent-orange`)
- **shadcn/ui** (Radix primitives) — componentes en `src/components/ui/`
- **Supabase** — auth, base de datos PostgreSQL, realtime subscriptions
- **TanStack Query v5** disponible pero no usado ampliamente aún
- **react-router-dom v6** — rutas en `src/App.tsx`
- **XLSX + papaparse** — importar inventario desde Excel/CSV
- **Recharts** — gráficos
- **Sonner** — toasts
- **Vitest + Testing Library** — tests en `src/test/`

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción
npm run build:dev    # build en modo development
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest en modo watch
```

## Variables de entorno (`.env`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

## Estructura del proyecto

```
src/
  pages/
    Index.tsx          # página principal (toda la lógica de ensayos)
    Auth.tsx           # login / registro
    NotFound.tsx
  components/
    ui/                # componentes shadcn (no modificar manualmente)
    dashboard/
      Charts.tsx
      StatBlock.tsx
      UploadZone.tsx
    EditUltimosDialog.tsx   # editar últimos registros ingresados
    HistorialDialog.tsx     # ver historial de acciones
    NavLink.tsx
  hooks/
    useAuth.tsx        # contexto de autenticación (Supabase)
    use-mobile.tsx
    use-toast.ts
  integrations/
    supabase/
      client.ts        # createClient con env vars
      types.ts         # tipos generados automáticamente (no editar a mano)
  lib/
    exportRegistros.ts # exportar a XLSX/CSV (productividad, pérdidas, tallos, ramos)
    historial.ts       # logHistorial() — escribe en tabla `historial`
    parseFile.ts       # parseo de archivos de inventario
    utils.ts           # cn() y helpers
```

## Modelo de datos (Supabase)

Un **ensayo** se identifica por un código de 5 dígitos numéricos.

| Tabla | Descripción |
|---|---|
| `ensayos` | catálogo de ensayos (codigo PK) |
| `siembras` | inventario de siembras (bloque, cm/cama, nom_flor, plantas) |
| `tratamientos` | tratamientos por cama (nombre, parcelas, plantas_lista[]) |
| `causas_personalizadas` | causas de pérdida adicionales por ensayo |
| `productividad` | registros de corte (ramos, tallos_por_ramo, tallos_de_mas, total) |
| `perdidas` | registros de pérdidas (causa, tallos, plantas_iniciales) |
| `tallos` | mediciones de longitud y puntos/botones por tallo |
| `ramos_peso` | peso de ramos (tallos_por_ramo, peso_g) |
| `historial` | log de todas las acciones del usuario |
| `profiles` | perfil extendido del usuario (nombre_completo, email) |

Todas las tablas tienen `ensayo_codigo` como FK de filtrado. Los realtime subscriptions se crean por canal y se limpian en el `useEffect` cleanup.

## Flujo principal (Index.tsx)

1. El usuario ingresa o crea un ensayo con código de 5 dígitos
2. **Vista Inventario**: carga archivo XLSX con columnas `BLOQUE, CM, SEMANA, FECHA, PRODUCTO, NOM_FLOR, PLANTAS`
3. **Vista Toma datos**: registra hasta 4 grupos simultáneos por sección:
   - Productividad (ramos × tallos + tallos de más)
   - Pérdidas (causa + tallos perdidos)
   - Longitud y puntos (longitud_cm, botones, opcionalmente piso 2)
   - Peso de ramo (tallos/ramo, peso en gramos)
4. **Vista Registros**: tablas acumuladas + exportación XLSX/CSV por sección

## Convenciones de código

- Clases Tailwind reutilizables definidas como constantes locales en `Index.tsx` (`inp`, `btnSec`, `groupCard`, `groupsRow`)
- Color `lapis` = azul marino corporativo; `accent-orange` = naranja de acento
- `logHistorial()` se llama después de cada operación exitosa de escritura
- Guardado seguro: flag `saving[key]` por (sección, índice) para prevenir doble submit
- Paginación de 1000 registros en `siembras` (loop hasta que retorne menos de pageSize)
- `MAX_GRUPOS = 4` grupos por sección de toma de datos

## Notas importantes

- `src/integrations/supabase/types.ts` es generado automáticamente — no editar a mano; regenerar con `supabase gen types typescript`
- Los componentes de `src/components/ui/` son de shadcn/ui — editar solo si es necesario extender un componente
- La app usa `localStorage` para persistir el `ensayo_codigo` activo entre sesiones
- Funciones de limpieza de DB (`cleanup_ensayos_inactive`, `cleanup_historial_old`) existen como funciones SQL en Supabase
