# Plan: Autenticación + Historial de cambios + Seguridad RLS

## 1. Autenticación (email + contraseña)

- Implementar autenticación de Lovable Cloud con **email + contraseña** (sin Google, según el flujo descrito).
- Crear página `/auth` con dos pestañas: **Iniciar sesión** y **Registrarse**.
  - Registro pide: nombre completo, email, contraseña.
  - El nombre se guarda en una tabla `profiles` (creada automáticamente por trigger al registrarse).
- Auto-confirmar email activado (para no requerir verificación por correo en este flujo de campo).
- Proteger la página principal (`/`): si no hay sesión → redirigir a `/auth`.
- El flujo actual de "ingresar código de 5 dígitos del ensayo" se mantiene **después** del login.
- Agregar botón **"Cerrar sesión"** junto al actual botón **"Salir"** del ensayo.

## 2. Tabla `profiles`

Campos: `id`, `user_id` (FK a auth.users), `nombre_completo`, `email`, timestamps.

- Trigger `handle_new_user()` que inserta el profile al registrarse, leyendo `nombre_completo` del `raw_user_meta_data`.
- RLS: cualquier usuario autenticado puede leer profiles (para mostrar nombres en el historial); solo el dueño puede actualizar el suyo.

## 3. Tabla `historial` (auditoría)

Campos:
- `id`, `created_at`
- `ensayo_codigo` (text) — para filtrar el historial por ensayo
- `user_id` (uuid), `user_nombre` (text, denormalizado para no romperse si se borra el perfil)
- `accion` (text): `insert` | `update` | `delete`
- `tabla` (text): `productividad` | `perdidas` | `tallos` | `ramos_peso` | `tratamientos` | `siembras` | `causas_personalizadas` | `ensayos`
- `registro_id` (uuid, nullable)
- `descripcion` (text) — resumen legible, p.ej. *"Registró 12 ramos en cama C-3 (Variedad X)"*
- `datos` (jsonb, nullable) — payload de respaldo con los campos clave

RLS: solo lectura/inserción para usuarios autenticados.

## 4. Registro de auditoría desde el frontend

En lugar de triggers de base de datos (más frágiles ante cambios de esquema), usar un helper `logHistorial({ ensayo_codigo, accion, tabla, registro_id, descripcion, datos })` en `src/lib/historial.ts`. Llamarlo después de cada operación exitosa de:

- Crear/editar/borrar tratamientos, siembras, causas
- Insertar productividad, pérdidas, tallos, ramos_peso
- Editar/eliminar desde el diálogo "Editar últimos 3 registros"

El `user_id` y `user_nombre` se obtienen de la sesión actual.

## 5. Vista de Historial

- Botón **"Historial"** junto al botón "Salir" en la barra superior del ensayo.
- Abre un diálogo (`HistorialDialog.tsx`) con tabla cronológica descendente filtrada por `ensayo_codigo`:
  - Fecha/hora · Usuario · Acción · Tabla · Descripción
- Paginación simple (cargar últimos 200, botón "cargar más").

## 6. Endurecimiento de RLS (corrige los hallazgos del escáner)

Reemplazar todas las políticas `USING (true)` / `WITH CHECK (true)` por:

- **SELECT**: `to authenticated USING (true)` (los datos del ensayo siguen visibles para cualquier usuario autenticado que conozca el código — coherente con el modelo actual).
- **INSERT / UPDATE / DELETE**: `to authenticated WITH CHECK (auth.uid() IS NOT NULL)` en todas las tablas: `datasets`, `ensayos`, `perdidas`, `productividad`, `ramos_peso`, `siembras`, `tallos`, `tratamientos`, `causas_personalizadas`, `historial`, `profiles`.
- Quitar el rol `public` de todas las políticas de escritura.

Esto cierra los hallazgos #1 y #3 del escáner.

> Nota sobre el hallazgo #2 (Realtime): la app actual no usa suscripciones Realtime activas, así que el riesgo es teórico. Si más adelante se usan, agregaremos políticas en `realtime.messages`. Lo marcaré como aceptado por ahora con justificación.

## 7. Archivos a crear / modificar

**Nuevos:**
- `supabase/migrations/<timestamp>_auth_historial_rls.sql` — profiles, historial, trigger handle_new_user, GRANTs, RLS nuevas.
- `src/pages/Auth.tsx` — login/registro.
- `src/components/HistorialDialog.tsx`.
- `src/lib/historial.ts` — helper `logHistorial`.
- `src/hooks/useAuth.tsx` — provider y hook de sesión.

**Modificados:**
- `src/App.tsx` — rutas `/auth`, protección de `/`.
- `src/pages/Index.tsx` — botones "Historial" y "Cerrar sesión"; llamadas a `logHistorial` en cada mutación.
- `src/components/EditUltimosDialog.tsx` — llamadas a `logHistorial` en update/delete.

## 8. Configuración de auth

- `auto_confirm_email: true` (campo, sin verificación de email)
- `disable_signup: false`
- `password_hibp_enabled: true` (chequeo de contraseñas filtradas)
- `external_anonymous_users_enabled: false`

## 9. Migración de datos existentes

Los registros previos no tienen historial. No se intenta reconstruir; el historial empieza desde la activación.

---

¿Apruebas este plan para proceder?