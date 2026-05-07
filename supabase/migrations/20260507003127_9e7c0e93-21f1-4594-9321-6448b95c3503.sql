CREATE TABLE public.tallos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cama text NOT NULL,
  variedad text NOT NULL,
  parcela text NOT NULL,
  tratamiento text NOT NULL,
  numero integer NOT NULL,
  longitud_cm numeric NOT NULL DEFAULT 0,
  botones integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.tallos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view tallos" ON public.tallos FOR SELECT USING (true);
CREATE POLICY "Public insert tallos" ON public.tallos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete tallos" ON public.tallos FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.tallos;