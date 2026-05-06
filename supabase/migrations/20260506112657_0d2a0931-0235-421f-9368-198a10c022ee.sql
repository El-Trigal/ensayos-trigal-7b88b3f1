CREATE TABLE public.productividad (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cama TEXT NOT NULL,
  variedad TEXT NOT NULL,
  parcela TEXT NOT NULL,
  tratamiento TEXT NOT NULL,
  ramos INTEGER NOT NULL DEFAULT 0,
  tallos_por_ramo INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.productividad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view productividad" ON public.productividad FOR SELECT USING (true);
CREATE POLICY "Public insert productividad" ON public.productividad FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete productividad" ON public.productividad FOR DELETE USING (true);

CREATE TABLE public.perdidas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cama TEXT NOT NULL,
  variedad TEXT NOT NULL,
  parcela TEXT NOT NULL,
  tratamiento TEXT NOT NULL,
  causa TEXT NOT NULL,
  tallos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.perdidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view perdidas" ON public.perdidas FOR SELECT USING (true);
CREATE POLICY "Public insert perdidas" ON public.perdidas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete perdidas" ON public.perdidas FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.productividad;
ALTER PUBLICATION supabase_realtime ADD TABLE public.perdidas;