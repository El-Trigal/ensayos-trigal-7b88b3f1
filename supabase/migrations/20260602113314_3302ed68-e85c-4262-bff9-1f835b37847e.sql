
-- 1) PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- trigger to set updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nombre_completo, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email),
    NEW.email
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) HISTORIAL
CREATE TABLE public.historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ensayo_codigo text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_nombre text NOT NULL,
  accion text NOT NULL,
  tabla text NOT NULL,
  registro_id uuid,
  descripcion text NOT NULL,
  datos jsonb
);

CREATE INDEX idx_historial_ensayo_created ON public.historial (ensayo_codigo, created_at DESC);

GRANT SELECT, INSERT ON public.historial TO authenticated;
GRANT ALL ON public.historial TO service_role;

ALTER TABLE public.historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view historial"
  ON public.historial FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert historial"
  ON public.historial FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3) HARDEN RLS on existing tables: drop public policies, recreate as authenticated-only.

-- helper: do per table
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'datasets','ensayos','perdidas','productividad','ramos_peso',
    'siembras','tallos','tratamientos','causas_personalizadas'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    -- revoke from anon/public, grant to authenticated only
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, public', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    -- new policies
    EXECUTE format('CREATE POLICY "Auth select %I" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "Auth insert %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "Auth update %I" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "Auth delete %I" ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)', t, t);
  END LOOP;
END $$;
