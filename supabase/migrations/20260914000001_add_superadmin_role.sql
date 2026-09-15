-- =====================================================================
-- Migración v2.1: Rol superadmin + función auth_is_admin()
-- EJECUTAR en: Supabase Dashboard → SQL Editor
-- =====================================================================

-- 1. Extender CHECK constraint en profiles.rol
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('superadmin', 'admin', 'jefe', 'aprendiz'));

-- 2. Funciones helper de autenticación
CREATE OR REPLACE FUNCTION public.auth_is_admin()
  RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT rol IN ('superadmin', 'admin') FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    false
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auth_is_admin() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.auth_rol()
  RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT rol FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    'aprendiz'
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auth_rol() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.auth_sede_id()
  RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN (SELECT sede_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auth_sede_id() FROM PUBLIC, anon;

-- 3. sedes
DROP POLICY IF EXISTS "sedes_insert" ON public.sedes;
DROP POLICY IF EXISTS "sedes_update" ON public.sedes;
DROP POLICY IF EXISTS "sedes_delete" ON public.sedes;
CREATE POLICY "sedes_insert" ON public.sedes FOR INSERT TO authenticated WITH CHECK (public.auth_is_admin());
CREATE POLICY "sedes_update" ON public.sedes FOR UPDATE TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "sedes_delete" ON public.sedes FOR DELETE TO authenticated USING (public.auth_is_admin());

-- 4. profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR sede_id = public.auth_sede_id() OR user_id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.auth_is_admin() OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()) OR user_id = auth.uid())
  WITH CHECK (public.auth_is_admin() OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()) OR user_id = auth.uid());

-- 5. variedades
DROP POLICY IF EXISTS "variedades_insert" ON public.variedades;
DROP POLICY IF EXISTS "variedades_update" ON public.variedades;
DROP POLICY IF EXISTS "variedades_delete" ON public.variedades;
CREATE POLICY "variedades_insert" ON public.variedades FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_admin() OR public.auth_rol() = 'jefe');
CREATE POLICY "variedades_update" ON public.variedades FOR UPDATE TO authenticated
  USING (public.auth_is_admin() OR public.auth_rol() = 'jefe');
CREATE POLICY "variedades_delete" ON public.variedades FOR DELETE TO authenticated
  USING (public.auth_is_admin());

-- 6. ensayos
DROP POLICY IF EXISTS "ensayos_select" ON public.ensayos;
DROP POLICY IF EXISTS "ensayos_insert" ON public.ensayos;
DROP POLICY IF EXISTS "ensayos_update" ON public.ensayos;
DROP POLICY IF EXISTS "ensayos_delete" ON public.ensayos;
CREATE POLICY "ensayos_select" ON public.ensayos FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR sede_id = public.auth_sede_id());
CREATE POLICY "ensayos_insert" ON public.ensayos FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_admin() OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()));
CREATE POLICY "ensayos_update" ON public.ensayos FOR UPDATE TO authenticated
  USING (public.auth_is_admin() OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()));
CREATE POLICY "ensayos_delete" ON public.ensayos FOR DELETE TO authenticated
  USING (public.auth_is_admin());

-- 7. causas
DROP POLICY IF EXISTS "causas_select" ON public.causas;
DROP POLICY IF EXISTS "causas_insert" ON public.causas;
DROP POLICY IF EXISTS "causas_delete" ON public.causas;
CREATE POLICY "causas_select" ON public.causas FOR SELECT TO authenticated
  USING (es_fija = true OR public.auth_is_admin()
    OR ensayo_id IN (SELECT id FROM public.ensayos WHERE sede_id = public.auth_sede_id()));
CREATE POLICY "causas_insert" ON public.causas FOR INSERT TO authenticated
  WITH CHECK (es_fija = false AND (public.auth_is_admin()
    OR ensayo_id IN (SELECT id FROM public.ensayos WHERE sede_id = public.auth_sede_id())));
CREATE POLICY "causas_delete" ON public.causas FOR DELETE TO authenticated
  USING (es_fija = false AND (public.auth_is_admin()
    OR (public.auth_rol() = 'jefe'
        AND ensayo_id IN (SELECT id FROM public.ensayos WHERE sede_id = public.auth_sede_id()))));

-- 8. siembras
DROP POLICY IF EXISTS "siembras_select" ON public.siembras;
DROP POLICY IF EXISTS "siembras_insert" ON public.siembras;
DROP POLICY IF EXISTS "siembras_update" ON public.siembras;
DROP POLICY IF EXISTS "siembras_delete" ON public.siembras;
CREATE POLICY "siembras_select" ON public.siembras FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR sede_id = public.auth_sede_id());
CREATE POLICY "siembras_insert" ON public.siembras FOR INSERT TO authenticated
  WITH CHECK (sede_id = public.auth_sede_id() AND (public.auth_is_admin() OR public.auth_rol() = 'jefe'));
CREATE POLICY "siembras_update" ON public.siembras FOR UPDATE TO authenticated
  USING (public.auth_is_admin() OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()));
CREATE POLICY "siembras_delete" ON public.siembras FOR DELETE TO authenticated
  USING (public.auth_is_admin() OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()));

-- 9. tratamientos
DROP POLICY IF EXISTS "tratamientos_select" ON public.tratamientos;
DROP POLICY IF EXISTS "tratamientos_insert" ON public.tratamientos;
DROP POLICY IF EXISTS "tratamientos_update" ON public.tratamientos;
DROP POLICY IF EXISTS "tratamientos_delete" ON public.tratamientos;
CREATE POLICY "tratamientos_select" ON public.tratamientos FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR sede_id = public.auth_sede_id());
CREATE POLICY "tratamientos_insert" ON public.tratamientos FOR INSERT TO authenticated
  WITH CHECK (sede_id = public.auth_sede_id() AND (public.auth_is_admin() OR public.auth_rol() = 'jefe'));
CREATE POLICY "tratamientos_update" ON public.tratamientos FOR UPDATE TO authenticated
  USING (public.auth_is_admin() OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()));
CREATE POLICY "tratamientos_delete" ON public.tratamientos FOR DELETE TO authenticated
  USING (public.auth_is_admin() OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id()));

-- 10. productividad
DROP POLICY IF EXISTS "productividad_select" ON public.productividad;
DROP POLICY IF EXISTS "productividad_update" ON public.productividad;
DROP POLICY IF EXISTS "productividad_delete" ON public.productividad;
CREATE POLICY "productividad_select" ON public.productividad FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR sede_id = public.auth_sede_id());
CREATE POLICY "productividad_update" ON public.productividad FOR UPDATE TO authenticated
  USING (public.auth_is_admin()
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()    AND sede_id = public.auth_sede_id()));
CREATE POLICY "productividad_delete" ON public.productividad FOR DELETE TO authenticated
  USING (public.auth_is_admin()
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()    AND sede_id = public.auth_sede_id()));

-- 11. perdidas
DROP POLICY IF EXISTS "perdidas_select" ON public.perdidas;
DROP POLICY IF EXISTS "perdidas_update" ON public.perdidas;
DROP POLICY IF EXISTS "perdidas_delete" ON public.perdidas;
CREATE POLICY "perdidas_select" ON public.perdidas FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR sede_id = public.auth_sede_id());
CREATE POLICY "perdidas_update" ON public.perdidas FOR UPDATE TO authenticated
  USING (public.auth_is_admin()
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()    AND sede_id = public.auth_sede_id()));
CREATE POLICY "perdidas_delete" ON public.perdidas FOR DELETE TO authenticated
  USING (public.auth_is_admin()
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()    AND sede_id = public.auth_sede_id()));

-- 12. tallos
DROP POLICY IF EXISTS "tallos_select" ON public.tallos;
DROP POLICY IF EXISTS "tallos_update" ON public.tallos;
DROP POLICY IF EXISTS "tallos_delete" ON public.tallos;
CREATE POLICY "tallos_select" ON public.tallos FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR sede_id = public.auth_sede_id());
CREATE POLICY "tallos_update" ON public.tallos FOR UPDATE TO authenticated
  USING (public.auth_is_admin()
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()    AND sede_id = public.auth_sede_id()));
CREATE POLICY "tallos_delete" ON public.tallos FOR DELETE TO authenticated
  USING (public.auth_is_admin()
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()    AND sede_id = public.auth_sede_id()));

-- 13. ramos_peso
DROP POLICY IF EXISTS "ramos_peso_select" ON public.ramos_peso;
DROP POLICY IF EXISTS "ramos_peso_update" ON public.ramos_peso;
DROP POLICY IF EXISTS "ramos_peso_delete" ON public.ramos_peso;
CREATE POLICY "ramos_peso_select" ON public.ramos_peso FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR sede_id = public.auth_sede_id());
CREATE POLICY "ramos_peso_update" ON public.ramos_peso FOR UPDATE TO authenticated
  USING (public.auth_is_admin()
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()    AND sede_id = public.auth_sede_id()));
CREATE POLICY "ramos_peso_delete" ON public.ramos_peso FOR DELETE TO authenticated
  USING (public.auth_is_admin()
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()    AND sede_id = public.auth_sede_id()));

-- 14. diametros
DROP POLICY IF EXISTS "diametros_select" ON public.diametros;
DROP POLICY IF EXISTS "diametros_update" ON public.diametros;
DROP POLICY IF EXISTS "diametros_delete" ON public.diametros;
CREATE POLICY "diametros_select" ON public.diametros FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR sede_id = public.auth_sede_id());
CREATE POLICY "diametros_update" ON public.diametros FOR UPDATE TO authenticated
  USING (public.auth_is_admin()
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()    AND sede_id = public.auth_sede_id()));
CREATE POLICY "diametros_delete" ON public.diametros FOR DELETE TO authenticated
  USING (public.auth_is_admin()
    OR (public.auth_rol() = 'jefe' AND sede_id = public.auth_sede_id())
    OR (created_by = auth.uid()    AND sede_id = public.auth_sede_id()));

-- 15. historial
DROP POLICY IF EXISTS "historial_select" ON public.historial;
CREATE POLICY "historial_select" ON public.historial FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR sede_id = public.auth_sede_id());

-- 16. Asignar superadmin a julian.guevara@floreseltrigal.com
UPDATE public.profiles
  SET rol = 'superadmin'
  WHERE email = 'julian.guevara@floreseltrigal.com';
