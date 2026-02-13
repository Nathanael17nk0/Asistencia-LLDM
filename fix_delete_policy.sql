-- PERMITIR BORRAR USUARIOS Y REGISTROS
-- Ejecuta esto en Supabase SQL Editor

-- 1. Permitir borrar logs de asistencia
CREATE POLICY "Enable delete for anon on attendance_log"
ON attendance_log
FOR DELETE
TO anon
USING (true);

-- 2. Permitir borrar usuarios
CREATE POLICY "Enable delete for anon on attendance_users"
ON attendance_users
FOR DELETE
TO anon
USING (true);

-- 3. Asegurar que las políticas anteriores no bloquen
-- (Supabase es "Permisivo" si hay al menos una política que lo permita,
--  pero si no había ninguna policy FOR DELETE, estaba bloqueado por defecto).
