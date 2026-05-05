CREATE TABLE public.datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  row_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view datasets" ON public.datasets FOR SELECT USING (true);
CREATE POLICY "Public can insert datasets" ON public.datasets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can delete datasets" ON public.datasets FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.datasets;
ALTER TABLE public.datasets REPLICA IDENTITY FULL;