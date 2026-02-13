-- 🚨 RECREACIÓN TOTAL DE LA TABLA DE CONFIGURACIÓN 🚨
-- Esto borrará el horario y el tema actual, pero arreglará la base de datos para siempre.

-- 1. Borrar la tabla corrupta
DROP TABLE IF EXISTS public.attendance_config;

-- 2. Crear la tabla correctamente (con 'key' como Llave Primaria)
CREATE TABLE public.attendance_config (
    key text PRIMARY KEY,
    value jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Habilitar Seguridad (RLS)
ALTER TABLE public.attendance_config ENABLE ROW LEVEL SECURITY;

-- 4. Crear Política de Acceso Total (para que funcione el celular)
CREATE POLICY "Allow All Config" ON public.attendance_config FOR ALL USING (true) WITH CHECK (true);

-- 5. Dar permisos a todos
GRANT ALL ON TABLE public.attendance_config TO anon, authenticated, service_role;

-- 6. Activar Tiempo Real
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_config;
