-- Enable pg_cron for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1) Cleanup function: delete historial entries older than 3 days
CREATE OR REPLACE FUNCTION public.cleanup_historial_old()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.historial WHERE created_at < now() - interval '3 days';
$$;

-- 2) Cleanup function: delete ensayos (and all associated data) with no activity in 30 days.
-- "Activity" = any insert/delete recorded in historial for that ensayo OR any record created in data tables.
CREATE OR REPLACE FUNCTION public.cleanup_ensayos_inactive()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - interval '30 days';
  codigos text[];
BEGIN
  SELECT array_agg(e.codigo) INTO codigos
  FROM public.ensayos e
  WHERE e.created_at < cutoff
    AND NOT EXISTS (SELECT 1 FROM public.historial h    WHERE h.ensayo_codigo = e.codigo AND h.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.productividad p WHERE p.ensayo_codigo = e.codigo AND p.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.perdidas pe    WHERE pe.ensayo_codigo = e.codigo AND pe.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.tallos t       WHERE t.ensayo_codigo = e.codigo AND t.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.ramos_peso r   WHERE r.ensayo_codigo = e.codigo AND r.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.tratamientos tr WHERE tr.ensayo_codigo = e.codigo AND tr.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.siembras s     WHERE s.ensayo_codigo = e.codigo AND s.created_at >= cutoff)
    AND NOT EXISTS (SELECT 1 FROM public.causas_personalizadas c WHERE c.ensayo_codigo = e.codigo AND c.created_at >= cutoff);

  IF codigos IS NULL OR array_length(codigos, 1) IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.productividad        WHERE ensayo_codigo = ANY(codigos);
  DELETE FROM public.perdidas             WHERE ensayo_codigo = ANY(codigos);
  DELETE FROM public.tallos               WHERE ensayo_codigo = ANY(codigos);
  DELETE FROM public.ramos_peso           WHERE ensayo_codigo = ANY(codigos);
  DELETE FROM public.tratamientos         WHERE ensayo_codigo = ANY(codigos);
  DELETE FROM public.siembras             WHERE ensayo_codigo = ANY(codigos);
  DELETE FROM public.causas_personalizadas WHERE ensayo_codigo = ANY(codigos);
  DELETE FROM public.historial            WHERE ensayo_codigo = ANY(codigos);
  DELETE FROM public.ensayos              WHERE codigo = ANY(codigos);
END;
$$;

-- Unschedule previous versions if re-running
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-historial-3-days') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-historial-3-days');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-ensayos-30-days') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-ensayos-30-days');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Schedule daily cleanup at 03:00 UTC
SELECT cron.schedule('cleanup-historial-3-days', '0 3 * * *', $$SELECT public.cleanup_historial_old();$$);
SELECT cron.schedule('cleanup-ensayos-30-days',  '15 3 * * *', $$SELECT public.cleanup_ensayos_inactive();$$);