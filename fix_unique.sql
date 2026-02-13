-- 1. Asegurar que no hay duplicados (por si acaso)
DELETE FROM public.attendance_config 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM public.attendance_config 
    GROUP BY key
);

-- 2. Agregar restricción UNIQUE a la columna 'key'
-- Esto permite que 'key' funcione como identificador único sin ser la Primary Key (que ya existe).
ALTER TABLE public.attendance_config ADD CONSTRAINT attendance_config_key_unique UNIQUE (key);
