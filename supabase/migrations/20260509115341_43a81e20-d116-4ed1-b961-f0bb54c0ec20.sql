ALTER TABLE public.productividad ADD COLUMN IF NOT EXISTS bloque integer;
ALTER TABLE public.perdidas ADD COLUMN IF NOT EXISTS bloque integer;
ALTER TABLE public.perdidas ADD COLUMN IF NOT EXISTS plantas_iniciales integer;
ALTER TABLE public.tallos ADD COLUMN IF NOT EXISTS bloque integer;
ALTER TABLE public.ramos_peso ADD COLUMN IF NOT EXISTS bloque integer;