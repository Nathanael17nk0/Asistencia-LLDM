-- 🚨 REINICIO TOTAL + DATOS DE PRUEBA 🚨

-- 1. Borrar Tabla
DROP TABLE IF EXISTS public.attendance_config;

-- 2. Crear Tabla Correcta
CREATE TABLE public.attendance_config (
    key text PRIMARY KEY,
    value jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Permisos
ALTER TABLE public.attendance_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All Config" ON public.attendance_config FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.attendance_config TO anon, authenticated, service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_config;

-- 4. 💉 INYECTAR HORARIO DE PRUEBA DIRECTAMENTE 💉
INSERT INTO public.attendance_config (key, value)
VALUES (
  'weekly_schedule', 
  '{
    "2026-02-09": {"5am": "Hno Prueba 5AM", "9am": "Hno Prueba 9AM", "7pm": "Hno Prueba 7PM", "special": ""},
    "2026-02-10": {"5am": "Hno Martes", "9am": "Hno Martes", "7pm": "Hno Martes", "special": ""}
  }'::jsonb
);

-- 5. Inyectar Tema
INSERT INTO public.attendance_config (key, value)
VALUES ('weekly_theme', '"TEMA DE PRUEBA INSERTADO POR SQL"'::jsonb);
