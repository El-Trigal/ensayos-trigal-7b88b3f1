CREATE TABLE public.siembras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bloque INTEGER NOT NULL,
  cm TEXT NOT NULL,
  semana TEXT,
  fecha DATE,
  producto TEXT,
  nom_flor TEXT NOT NULL,
  plantas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_siembras_bloque_cm ON public.siembras(bloque, cm);
ALTER TABLE public.siembras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view siembras" ON public.siembras FOR SELECT USING (true);
CREATE POLICY "Public insert siembras" ON public.siembras FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete siembras" ON public.siembras FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.siembras;