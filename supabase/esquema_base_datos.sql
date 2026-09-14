-- ============================================================
-- Esquema v2 — Aplicativo de Ensayos — Flores el Trigal
-- Multi-sede | Roles: admin / jefe / aprendiz | Normalizado
-- ============================================================
-- INSTRUCCIONES:
--   1. En Supabase SQL Editor: ejecutar este archivo completo.
--   2. Luego insertar las 4 sedes reales descomentando el bloque
--      "DATOS SEMILLA → Sedes" al final del archivo.
-- ============================================================

-- ===================== EXTENSIONES =====================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;   -- habilitar en Dashboard → Extensions si falla


-- ===================== FUNCIONES HELPER =====================
-- Solo set_updated_at y handle_new_user aquí (no referencian tablas).
-- Las funciones de limpieza van al final, después de las tablas.

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Retorna el rol del usuario autenticado (plpgsql = lazy binding, no valida tablas al crearse)
CREATE OR REPLACE FUNCTION public.auth_rol()
  RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN (SELECT rol FROM public.profiles WHERE user_id = auth.uid() LIMIT 1);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auth_rol() FROM PUBLIC, anon;

-- Retorna la sede_id del usuario autenticado
CREATE OR REPLACE FUNCTION public.auth_sede_id()
  RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN (SELECT sede_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auth_sede_id() FROM PUBLIC, anon;

-- Crea perfil automáticamente al registrarse (rol por defecto: aprendiz, sede pendiente de asignar)
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nombre_completo, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'aprendiz')
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- ===================== TABLAS =====================

-- ---- sedes ----
-- Las 4 sedes de la empresa. Insertar manualmente al final del script.
CREATE TABLE IF NOT EXISTS public.sedes (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  codigo     text NOT NULL,
  activa     boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (codigo)
);

GRANT SELECT ON public.sedes TO authenticated;
GRANT ALL   ON public.sedes TO service_role;
ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;
-- Todos pueden ver sedes; solo admin puede modificar
CREATE POLICY "sedes_select" ON public.sedes FOR SELECT TO authenticated USING (true);
CREATE POLICY "sedes_insert" ON public.sedes FOR INSERT TO authenticated WITH CHECK (public.auth_rol() = 'admin');
CREATE POLICY "sedes_update" ON public.sedes FOR UPDATE TO authenticated USING (public.auth_rol() = 'admin') WITH CHECK (public.auth_rol() = 'admin');
CREATE POLICY "sedes_delete" ON public.sedes FOR DELETE TO authenticated USING (public.auth_rol() = 'admin');


-- ---- profiles ----
-- Un usuario pertenece a una sede y tiene un rol.
-- Hasta que admin asigne sede, el usuario puede entrar pero no ve datos.
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo text NOT NULL,
  email           text NOT NULL,
  rol             text NOT NULL DEFAULT 'aprendiz'
                      CHECK (rol IN ('admin', 'jefe', 'aprendiz')),
  sede_id         uuid REFERENCES public.sedes(id) ON DELETE SET NULL,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- admin: todos; jefe: su sede; aprendiz: solo el propio
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR sede_id = public.auth_sede_id()
    OR user_id = auth.uid()
  );
-- El trigger crea el perfil, el usuario no lo inserta directamente
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
-- admin actualiza cualquiera; jefe actualiza los de su sede; cada quien actualiza el suyo
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
    OR user_id = auth.uid()
  );
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---- variedades ----
-- Catálogo compartido de variedades de flor. Reduce errores de tipeo.
CREATE TABLE IF NOT EXISTS public.variedades (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  nom_flor   text NOT NULL,
  activa     boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (nom_flor)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.variedades TO authenticated;
GRANT ALL ON public.variedades TO service_role;
ALTER TABLE public.variedades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variedades_select" ON public.variedades FOR SELECT TO authenticated USING (true);
CREATE POLICY "variedades_insert" ON public.variedades FOR INSERT TO authenticated
  WITH CHECK (public.auth_rol() IN ('admin', 'jefe'));
CREATE POLICY "variedades_update" ON public.variedades FOR UPDATE TO authenticated
  USING (public.auth_rol() IN ('admin', 'jefe'));
CREATE POLICY "variedades_delete" ON public.variedades FOR DELETE TO authenticated
  USING (public.auth_rol() = 'admin');


-- ---- ensayos ----
-- Cada ensayo pertenece a una sede. Código = 5 dígitos (visible al usuario).
CREATE TABLE IF NOT EXISTS public.ensayos (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo     text NOT NULL CHECK (codigo ~ '^[0-9]{5}$'),
  sede_id    uuid NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  nombre     text,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (codigo)
);

CREATE INDEX IF NOT EXISTS idx_ensayos_sede ON public.ensayos USING btree (sede_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ensayos TO authenticated;
GRANT ALL ON public.ensayos TO service_role;
ALTER TABLE public.ensayos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ensayos REPLICA IDENTITY FULL;
-- aprendiz y jefe: solo ven los ensayos de su sede
CREATE POLICY "ensayos_select" ON public.ensayos FOR SELECT TO authenticated
  USING (public.auth_rol() = 'admin' OR sede_id = public.auth_sede_id());
-- solo admin y jefe pueden crear/editar ensayos
CREATE POLICY "ensayos_insert" ON public.ensayos FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
  );
CREATE POLICY "ensayos_update" ON public.ensayos FOR UPDATE TO authenticated
  USING (public.auth_rol() = 'admin' OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()));
CREATE POLICY "ensayos_delete" ON public.ensayos FOR DELETE TO authenticated
  USING (public.auth_rol() = 'admin');


-- ---- causas ----
-- Unifica causas fijas (del sistema) y personalizadas por ensayo.
-- es_fija = true  → causa global, ensayo_id = NULL
-- es_fija = false → causa personalizada, ensayo_id = el ensayo al que pertenece
CREATE TABLE IF NOT EXISTS public.causas (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  es_fija    boolean NOT NULL DEFAULT false,
  ensayo_id  uuid REFERENCES public.ensayos(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Unicidad separada para fijas vs. personalizadas
CREATE UNIQUE INDEX IF NOT EXISTS causas_fija_idx   ON public.causas (nombre)             WHERE es_fija = true;
CREATE UNIQUE INDEX IF NOT EXISTS causas_custom_idx ON public.causas (nombre, ensayo_id)  WHERE es_fija = false;
CREATE INDEX IF NOT EXISTS idx_causas_ensayo ON public.causas USING btree (ensayo_id);

GRANT SELECT, INSERT, DELETE ON public.causas TO authenticated;
GRANT ALL ON public.causas TO service_role;
ALTER TABLE public.causas ENABLE ROW LEVEL SECURITY;
-- Ver causas fijas siempre; ver causas de ensayos propios
CREATE POLICY "causas_select" ON public.causas FOR SELECT TO authenticated
  USING (
    es_fija = true
    OR public.auth_rol() = 'admin'
    OR ensayo_id IN (SELECT id FROM public.ensayos WHERE sede_id = public.auth_sede_id())
  );
-- Solo se pueden crear causas personalizadas (no fijas)
CREATE POLICY "causas_insert" ON public.causas FOR INSERT TO authenticated
  WITH CHECK (
    es_fija = false
    AND (
      public.auth_rol() = 'admin'
      OR ensayo_id IN (SELECT id FROM public.ensayos WHERE sede_id = public.auth_sede_id())
    )
  );
CREATE POLICY "causas_delete" ON public.causas FOR DELETE TO authenticated
  USING (
    es_fija = false
    AND (
      public.auth_rol() = 'admin'
      OR (public.auth_rol() = 'jefe'
          AND ensayo_id IN (SELECT id FROM public.ensayos WHERE sede_id = public.auth_sede_id()))
    )
  );


-- ---- siembras ----
-- Inventario de siembras. Usa variedad_id en vez de texto libre.
-- sede_id denormalizado para RLS eficiente sin JOIN.
CREATE TABLE IF NOT EXISTS public.siembras (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  ensayo_id    uuid NOT NULL REFERENCES public.ensayos(id) ON DELETE CASCADE,
  sede_id      uuid NOT NULL REFERENCES public.sedes(id)  ON DELETE RESTRICT,
  bloque       integer NOT NULL,
  cm           text NOT NULL,
  semana       text,
  fecha        date,
  producto     text,
  variedad_id  uuid REFERENCES public.variedades(id) ON DELETE SET NULL,
  plantas      integer NOT NULL DEFAULT 0,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_siembras_ensayo    ON public.siembras USING btree (ensayo_id);
CREATE INDEX IF NOT EXISTS idx_siembras_sede      ON public.siembras USING btree (sede_id);
CREATE INDEX IF NOT EXISTS idx_siembras_bloque_cm ON public.siembras USING btree (bloque, cm);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.siembras TO authenticated;
GRANT ALL ON public.siembras TO service_role;
ALTER TABLE public.siembras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siembras REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.siembras;
CREATE POLICY "siembras_select" ON public.siembras FOR SELECT TO authenticated
  USING (public.auth_rol() = 'admin' OR sede_id = public.auth_sede_id());
-- Solo admin y jefe cargan inventario
CREATE POLICY "siembras_insert" ON public.siembras FOR INSERT TO authenticated
  WITH CHECK (
    sede_id = public.auth_sede_id()
    AND public.auth_rol() IN ('admin', 'jefe')
  );
CREATE POLICY "siembras_update" ON public.siembras FOR UPDATE TO authenticated
  USING (public.auth_rol() = 'admin' OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()));
CREATE POLICY "siembras_delete" ON public.siembras FOR DELETE TO authenticated
  USING (public.auth_rol() = 'admin' OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()));


-- ---- tratamientos ----
-- FK a ensayo. sede_id denormalizado para RLS.
CREATE TABLE IF NOT EXISTS public.tratamientos (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  ensayo_id           uuid NOT NULL REFERENCES public.ensayos(id) ON DELETE CASCADE,
  sede_id             uuid NOT NULL REFERENCES public.sedes(id)   ON DELETE RESTRICT,
  cama                text NOT NULL,
  nombre              text NOT NULL,
  parcelas            integer NOT NULL DEFAULT 0,
  plantas_por_parcela integer NOT NULL DEFAULT 0,
  plantas_lista       jsonb,
  created_at          timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (ensayo_id, cama, nombre)
);

CREATE INDEX IF NOT EXISTS idx_tratamientos_ensayo ON public.tratamientos USING btree (ensayo_id);
CREATE INDEX IF NOT EXISTS idx_tratamientos_sede   ON public.tratamientos USING btree (sede_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tratamientos TO authenticated;
GRANT ALL ON public.tratamientos TO service_role;
ALTER TABLE public.tratamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamientos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tratamientos;
CREATE POLICY "tratamientos_select" ON public.tratamientos FOR SELECT TO authenticated
  USING (public.auth_rol() = 'admin' OR sede_id = public.auth_sede_id());
CREATE POLICY "tratamientos_insert" ON public.tratamientos FOR INSERT TO authenticated
  WITH CHECK (
    sede_id = public.auth_sede_id()
    AND public.auth_rol() IN ('admin', 'jefe')
  );
CREATE POLICY "tratamientos_update" ON public.tratamientos FOR UPDATE TO authenticated
  USING (public.auth_rol() = 'admin' OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()));
CREATE POLICY "tratamientos_delete" ON public.tratamientos FOR DELETE TO authenticated
  USING (public.auth_rol() = 'admin' OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()));


-- ---- productividad ----
-- FK a tratamiento (en vez de texto). total es columna GENERADA automáticamente.
-- variedad_id: la variedad cosechada en este registro (una cama puede tener varias).
-- created_by: quién registró el dato (para auditoría y permisos de edición).
CREATE TABLE IF NOT EXISTS public.productividad (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  ensayo_id       uuid NOT NULL REFERENCES public.ensayos(id)     ON DELETE CASCADE,
  sede_id         uuid NOT NULL REFERENCES public.sedes(id)       ON DELETE RESTRICT,
  tratamiento_id  uuid NOT NULL REFERENCES public.tratamientos(id) ON DELETE RESTRICT,
  parcela         smallint NOT NULL,
  variedad_id     uuid REFERENCES public.variedades(id) ON DELETE SET NULL,
  bloque          integer,
  ramos           integer NOT NULL DEFAULT 0,
  tallos_por_ramo integer NOT NULL DEFAULT 0,
  tallos_de_mas   integer NOT NULL DEFAULT 0,
  total           integer GENERATED ALWAYS AS (ramos * tallos_por_ramo + tallos_de_mas) STORED,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_productividad_ensayo ON public.productividad USING btree (ensayo_id);
CREATE INDEX IF NOT EXISTS idx_productividad_sede   ON public.productividad USING btree (sede_id);
CREATE INDEX IF NOT EXISTS idx_productividad_trat   ON public.productividad USING btree (tratamiento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.productividad TO authenticated;
GRANT ALL ON public.productividad TO service_role;
ALTER TABLE public.productividad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productividad REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.productividad;
CREATE POLICY "productividad_select" ON public.productividad FOR SELECT TO authenticated
  USING (public.auth_rol() = 'admin' OR sede_id = public.auth_sede_id());
-- Todos pueden insertar en su sede (created_by debe ser el propio usuario)
CREATE POLICY "productividad_insert" ON public.productividad FOR INSERT TO authenticated
  WITH CHECK (sede_id = public.auth_sede_id() AND created_by = auth.uid());
-- admin y jefe: editan cualquiera de su sede; aprendiz: solo los suyos
CREATE POLICY "productividad_update" ON public.productividad FOR UPDATE TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe'     AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()        AND sede_id = public.auth_sede_id())
  );
CREATE POLICY "productividad_delete" ON public.productividad FOR DELETE TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe'     AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()        AND sede_id = public.auth_sede_id())
  );


-- ---- perdidas ----
CREATE TABLE IF NOT EXISTS public.perdidas (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  ensayo_id        uuid NOT NULL REFERENCES public.ensayos(id)      ON DELETE CASCADE,
  sede_id          uuid NOT NULL REFERENCES public.sedes(id)        ON DELETE RESTRICT,
  tratamiento_id   uuid NOT NULL REFERENCES public.tratamientos(id) ON DELETE RESTRICT,
  parcela          smallint NOT NULL,
  variedad_id      uuid REFERENCES public.variedades(id) ON DELETE SET NULL,
  causa_id         uuid NOT NULL REFERENCES public.causas(id)       ON DELETE RESTRICT,
  bloque           integer,
  tallos           integer NOT NULL DEFAULT 0,
  plantas_iniciales integer,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_perdidas_ensayo ON public.perdidas USING btree (ensayo_id);
CREATE INDEX IF NOT EXISTS idx_perdidas_sede   ON public.perdidas USING btree (sede_id);
CREATE INDEX IF NOT EXISTS idx_perdidas_trat   ON public.perdidas USING btree (tratamiento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perdidas TO authenticated;
GRANT ALL ON public.perdidas TO service_role;
ALTER TABLE public.perdidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perdidas REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.perdidas;
CREATE POLICY "perdidas_select" ON public.perdidas FOR SELECT TO authenticated
  USING (public.auth_rol() = 'admin' OR sede_id = public.auth_sede_id());
CREATE POLICY "perdidas_insert" ON public.perdidas FOR INSERT TO authenticated
  WITH CHECK (sede_id = public.auth_sede_id() AND created_by = auth.uid());
CREATE POLICY "perdidas_update" ON public.perdidas FOR UPDATE TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe'  AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()     AND sede_id = public.auth_sede_id())
  );
CREATE POLICY "perdidas_delete" ON public.perdidas FOR DELETE TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe'  AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()     AND sede_id = public.auth_sede_id())
  );


-- ---- tallos ----
CREATE TABLE IF NOT EXISTS public.tallos (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  ensayo_id       uuid NOT NULL REFERENCES public.ensayos(id)      ON DELETE CASCADE,
  sede_id         uuid NOT NULL REFERENCES public.sedes(id)        ON DELETE RESTRICT,
  tratamiento_id  uuid NOT NULL REFERENCES public.tratamientos(id) ON DELETE RESTRICT,
  parcela         smallint NOT NULL,
  bloque          integer,
  numero          integer NOT NULL,
  longitud_cm     numeric NOT NULL DEFAULT 0,
  botones         integer NOT NULL DEFAULT 0,
  botones_piso2   integer,
  piso            text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_tallos_ensayo ON public.tallos USING btree (ensayo_id);
CREATE INDEX IF NOT EXISTS idx_tallos_sede   ON public.tallos USING btree (sede_id);
CREATE INDEX IF NOT EXISTS idx_tallos_trat   ON public.tallos USING btree (tratamiento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tallos TO authenticated;
GRANT ALL ON public.tallos TO service_role;
ALTER TABLE public.tallos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tallos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tallos;
CREATE POLICY "tallos_select" ON public.tallos FOR SELECT TO authenticated
  USING (public.auth_rol() = 'admin' OR sede_id = public.auth_sede_id());
CREATE POLICY "tallos_insert" ON public.tallos FOR INSERT TO authenticated
  WITH CHECK (sede_id = public.auth_sede_id() AND created_by = auth.uid());
CREATE POLICY "tallos_update" ON public.tallos FOR UPDATE TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe'  AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()     AND sede_id = public.auth_sede_id())
  );
CREATE POLICY "tallos_delete" ON public.tallos FOR DELETE TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe'  AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()     AND sede_id = public.auth_sede_id())
  );


-- ---- ramos_peso ----
CREATE TABLE IF NOT EXISTS public.ramos_peso (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  ensayo_id       uuid NOT NULL REFERENCES public.ensayos(id)      ON DELETE CASCADE,
  sede_id         uuid NOT NULL REFERENCES public.sedes(id)        ON DELETE RESTRICT,
  tratamiento_id  uuid NOT NULL REFERENCES public.tratamientos(id) ON DELETE RESTRICT,
  parcela         smallint NOT NULL,
  bloque          integer,
  numero          integer NOT NULL,
  tallos_por_ramo integer NOT NULL DEFAULT 0,
  peso_g          numeric NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_ramos_peso_ensayo ON public.ramos_peso USING btree (ensayo_id);
CREATE INDEX IF NOT EXISTS idx_ramos_peso_sede   ON public.ramos_peso USING btree (sede_id);
CREATE INDEX IF NOT EXISTS idx_ramos_peso_trat   ON public.ramos_peso USING btree (tratamiento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ramos_peso TO authenticated;
GRANT ALL ON public.ramos_peso TO service_role;
ALTER TABLE public.ramos_peso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ramos_peso REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ramos_peso;
CREATE POLICY "ramos_peso_select" ON public.ramos_peso FOR SELECT TO authenticated
  USING (public.auth_rol() = 'admin' OR sede_id = public.auth_sede_id());
CREATE POLICY "ramos_peso_insert" ON public.ramos_peso FOR INSERT TO authenticated
  WITH CHECK (sede_id = public.auth_sede_id() AND created_by = auth.uid());
CREATE POLICY "ramos_peso_update" ON public.ramos_peso FOR UPDATE TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe'  AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()     AND sede_id = public.auth_sede_id())
  );
CREATE POLICY "ramos_peso_delete" ON public.ramos_peso FOR DELETE TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe'  AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()     AND sede_id = public.auth_sede_id())
  );


-- ---- diametros ----
CREATE TABLE IF NOT EXISTS public.diametros (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  ensayo_id       uuid NOT NULL REFERENCES public.ensayos(id)      ON DELETE CASCADE,
  sede_id         uuid NOT NULL REFERENCES public.sedes(id)        ON DELETE RESTRICT,
  tratamiento_id  uuid NOT NULL REFERENCES public.tratamientos(id) ON DELETE RESTRICT,
  parcela         smallint NOT NULL,
  bloque          integer,
  numero          integer NOT NULL,
  diametro_cm     numeric NOT NULL,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_diametros_ensayo ON public.diametros USING btree (ensayo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diametros_sede   ON public.diametros USING btree (sede_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diametros TO authenticated;
GRANT ALL ON public.diametros TO service_role;
ALTER TABLE public.diametros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diametros_select" ON public.diametros FOR SELECT TO authenticated
  USING (public.auth_rol() = 'admin' OR sede_id = public.auth_sede_id());
CREATE POLICY "diametros_insert" ON public.diametros FOR INSERT TO authenticated
  WITH CHECK (sede_id = public.auth_sede_id() AND created_by = auth.uid());
CREATE POLICY "diametros_update" ON public.diametros FOR UPDATE TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe'  AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()     AND sede_id = public.auth_sede_id())
  );
CREATE POLICY "diametros_delete" ON public.diametros FOR DELETE TO authenticated
  USING (
    public.auth_rol() = 'admin'
    OR (public.auth_rol() = 'jefe'  AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()     AND sede_id = public.auth_sede_id())
  );
CREATE TRIGGER diametros_set_updated_at
  BEFORE UPDATE ON public.diametros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---- historial ----
-- Auditoría de acciones. ensayo_id y sede_id nullable para no perder
-- registros si se borra el ensayo.
CREATE TABLE IF NOT EXISTS public.historial (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  ensayo_id     uuid REFERENCES public.ensayos(id) ON DELETE SET NULL,
  sede_id       uuid REFERENCES public.sedes(id)   ON DELETE SET NULL,
  user_id       uuid REFERENCES auth.users(id)     ON DELETE SET NULL,
  user_nombre   text NOT NULL,
  accion        text NOT NULL CHECK (accion IN ('insert', 'update', 'delete')),
  tabla         text NOT NULL,
  registro_id   uuid,
  descripcion   text NOT NULL,
  datos         jsonb,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_historial_ensayo ON public.historial USING btree (ensayo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historial_sede   ON public.historial USING btree (sede_id,   created_at DESC);

GRANT SELECT, INSERT ON public.historial TO authenticated;
GRANT ALL ON public.historial TO service_role;
ALTER TABLE public.historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historial_select" ON public.historial FOR SELECT TO authenticated
  USING (public.auth_rol() = 'admin' OR sede_id = public.auth_sede_id());
CREATE POLICY "historial_insert" ON public.historial FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ---- datasets (legacy) ----
CREATE TABLE IF NOT EXISTS public.datasets (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  rows       jsonb NOT NULL DEFAULT '[]'::jsonb,
  columns    jsonb NOT NULL DEFAULT '[]'::jsonb,
  row_count  integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT ALL ON public.datasets TO service_role;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "datasets_select" ON public.datasets FOR SELECT TO authenticated USING (true);
CREATE POLICY "datasets_insert" ON public.datasets FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "datasets_update" ON public.datasets FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "datasets_delete" ON public.datasets FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);


-- ===================== TRIGGER: perfil automático al registrarse =====================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ===================== DATOS SEMILLA =====================

-- Causas fijas de pérdida (hardcodeadas en el frontend — ahora viven en DB)
INSERT INTO public.causas (nombre, es_fija) VALUES
  ('Botón corona',  true), ('Botrytis',      true), ('Compuesto',    true),
  ('Daño mecanico', true), ('Delgados',       true), ('Espiga corta', true),
  ('Flor Abierta',  true), ('Malformación',   true), ('Mezcla',       true),
  ('Mutación',      true), ('Pocos puntos',   true), ('Secadera',     true),
  ('Tallos cortos', true), ('Torcidos',       true), ('Vegetativo',   true)
ON CONFLICT DO NOTHING;

-- ▼▼▼ REEMPLAZAR CON LOS NOMBRES REALES DE LAS 4 SEDES ▼▼▼
INSERT INTO public.sedes (nombre, codigo) VALUES
   ('Caribe', 'S001'),
   ('Manantiales', 'S002'),
   ('Olas', 'S003'),
   ('Aguas Claras', 'S004');
-- ▲▲▲


-- ===================== FUNCIONES DE LIMPIEZA =====================
-- DEBEN ir después de las tablas (LANGUAGE sql resuelve referencias al crearse)

CREATE OR REPLACE FUNCTION public.cleanup_historial_old()
  RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  DELETE FROM public.historial WHERE created_at < now() - interval '3 days';
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_historial_old() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_ensayos_inactive()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cutoff timestamptz := now() - interval '30 days';
  ids    uuid[];
BEGIN
  SELECT array_agg(e.id) INTO ids
  FROM public.ensayos e
  WHERE e.created_at < cutoff
    AND NOT EXISTS (SELECT 1 FROM public.historial h      WHERE h.ensayo_id = e.id AND h.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.productividad p  WHERE p.ensayo_id = e.id AND p.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.perdidas pe      WHERE pe.ensayo_id = e.id AND pe.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.tallos t         WHERE t.ensayo_id = e.id AND t.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.ramos_peso r     WHERE r.ensayo_id = e.id AND r.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.diametros d      WHERE d.ensayo_id = e.id AND d.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.tratamientos tr  WHERE tr.ensayo_id = e.id AND tr.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.siembras s       WHERE s.ensayo_id = e.id AND s.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.causas c         WHERE c.ensayo_id = e.id AND c.created_at >= cutoff);

  IF ids IS NULL OR array_length(ids, 1) IS NULL THEN RETURN; END IF;

  DELETE FROM public.productividad  WHERE ensayo_id = ANY(ids);
  DELETE FROM public.perdidas       WHERE ensayo_id = ANY(ids);
  DELETE FROM public.tallos         WHERE ensayo_id = ANY(ids);
  DELETE FROM public.ramos_peso     WHERE ensayo_id = ANY(ids);
  DELETE FROM public.diametros      WHERE ensayo_id = ANY(ids);
  DELETE FROM public.tratamientos   WHERE ensayo_id = ANY(ids);
  DELETE FROM public.siembras       WHERE ensayo_id = ANY(ids);
  DELETE FROM public.causas         WHERE ensayo_id = ANY(ids);
  DELETE FROM public.historial      WHERE ensayo_id = ANY(ids);
  DELETE FROM public.ensayos        WHERE id = ANY(ids);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_ensayos_inactive() FROM PUBLIC, anon, authenticated;


-- ===================== TAREAS PROGRAMADAS (pg_cron) =====================
DO $$ BEGIN PERFORM cron.unschedule('cleanup-historial-3-days'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('cleanup-ensayos-30-days');  EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  PERFORM cron.schedule('cleanup-historial-3-days', '0 3 * * *',  'SELECT public.cleanup_historial_old()');
  PERFORM cron.schedule('cleanup-ensayos-30-days',  '15 3 * * *', 'SELECT public.cleanup_ensayos_inactive()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron no disponible. Habilitar en Dashboard → Database → Extensions → pg_cron.';
END $$;
