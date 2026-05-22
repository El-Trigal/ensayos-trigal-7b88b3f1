CREATE POLICY "Public update productividad" ON public.productividad FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public update perdidas" ON public.perdidas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public update tallos" ON public.tallos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public update ramos_peso" ON public.ramos_peso FOR UPDATE USING (true) WITH CHECK (true);