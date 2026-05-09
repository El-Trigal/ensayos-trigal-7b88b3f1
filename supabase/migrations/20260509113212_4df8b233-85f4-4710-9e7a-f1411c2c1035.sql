-- Tabla de ensayos: identificador único de 5 dígitos
CREATE TABLE public.ensayos (
  codigo text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ensayos_codigo_5digits CHECK (codigo ~ '^[0-9]{5}$')
);

ALTER TABLE public.ensayos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view ensayos" ON public.ensayos FOR SELECT USING (true);
CREATE POLICY "Public insert ensayos" ON public.ensayos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete ensayos" ON public.ensayos FOR DELETE USING (true);

-- Asociar registros existentes y nuevos al código del ensayo
ALTER TABLE public.siembras       ADD COLUMN ensayo_codigo text;
ALTER TABLE public.productividad  ADD COLUMN ensayo_codigo text;
ALTER TABLE public.perdidas       ADD COLUMN ensayo_codigo text;
ALTER TABLE public.tallos         ADD COLUMN ensayo_codigo text;
ALTER TABLE public.ramos_peso     ADD COLUMN ensayo_codigo text;

CREATE INDEX idx_siembras_ensayo      ON public.siembras(ensayo_codigo);
CREATE INDEX idx_productividad_ensayo ON public.productividad(ensayo_codigo);
CREATE INDEX idx_perdidas_ensayo      ON public.perdidas(ensayo_codigo);
CREATE INDEX idx_tallos_ensayo        ON public.tallos(ensayo_codigo);
CREATE INDEX idx_ramos_peso_ensayo    ON public.ramos_peso(ensayo_codigo);