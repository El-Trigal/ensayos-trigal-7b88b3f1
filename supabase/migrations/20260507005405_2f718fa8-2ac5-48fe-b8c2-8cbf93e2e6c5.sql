CREATE TABLE public.ramos_peso (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cama text NOT NULL,
  parcela text NOT NULL,
  tratamiento text NOT NULL,
  numero integer NOT NULL,
  tallos_por_ramo integer NOT NULL DEFAULT 0,
  peso_g numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ramos_peso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view ramos_peso" ON public.ramos_peso FOR SELECT USING (true);
CREATE POLICY "Public insert ramos_peso" ON public.ramos_peso FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete ramos_peso" ON public.ramos_peso FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ramos_peso;