
-- 1. Tabla tratamientos
CREATE TABLE public.tratamientos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ensayo_codigo text NOT NULL,
  cama text NOT NULL,
  nombre text NOT NULL,
  parcelas integer NOT NULL DEFAULT 0,
  plantas_por_parcela integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (ensayo_codigo, cama, nombre)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tratamientos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tratamientos TO authenticated;
GRANT ALL ON public.tratamientos TO service_role;

ALTER TABLE public.tratamientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view tratamientos" ON public.tratamientos FOR SELECT USING (true);
CREATE POLICY "Public insert tratamientos" ON public.tratamientos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update tratamientos" ON public.tratamientos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete tratamientos" ON public.tratamientos FOR DELETE USING (true);

-- 2. Tabla causas_personalizadas
CREATE TABLE public.causas_personalizadas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ensayo_codigo text NOT NULL,
  nombre text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (ensayo_codigo, nombre)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.causas_personalizadas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.causas_personalizadas TO authenticated;
GRANT ALL ON public.causas_personalizadas TO service_role;

ALTER TABLE public.causas_personalizadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view causas" ON public.causas_personalizadas FOR SELECT USING (true);
CREATE POLICY "Public insert causas" ON public.causas_personalizadas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete causas" ON public.causas_personalizadas FOR DELETE USING (true);

-- 3. Columna piso en tallos
ALTER TABLE public.tallos ADD COLUMN piso text;
