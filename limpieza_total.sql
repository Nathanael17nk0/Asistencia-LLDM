-- ⚠️ LIMPIEZA DE DUPLICADOS ⚠️

-- 1. Borrar Horario y Tema (Para subirlo limpio de nuevo)
DELETE FROM public.attendance_config WHERE key = 'weekly_schedule';
DELETE FROM public.attendance_config WHERE key = 'weekly_theme';
DELETE FROM public.attendance_config WHERE key = 'church_location';

-- 2. Asegurar que NO se puedan crear duplicados en el futuro
-- Intentamos hacer 'key' la llave primaria.
-- Si esto falla es que hay otros registros duplicados (borrarlos manualmente si es necesario).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_config_pkey') THEN
        ALTER TABLE public.attendance_config ADD CONSTRAINT attendance_config_pkey PRIMARY KEY (key);
    END IF;
END $$;

-- 3. Verificar Tabla de Usuarios
-- Asegurar que el teléfono sea único
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_users_phone_key') THEN
        ALTER TABLE public.attendance_users ADD CONSTRAINT attendance_users_phone_key UNIQUE (phone);
    END IF;
END $$;
