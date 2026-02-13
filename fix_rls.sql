-- HABILITAR EL ACCESO PÚBLICO (ANON) PARA LEER Y ESCRIBIR
-- Copia y pega esto en el SQL Editor de Supabase y dale "Run"

-- 1. Habilitar RLS (Seguridad) en las tablas (si no está ya)
ALTER TABLE attendance_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_log ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Anon Select Users" ON attendance_users;
DROP POLICY IF EXISTS "Anon Insert Users" ON attendance_users;
DROP POLICY IF EXISTS "Anon Update Users" ON attendance_users;

DROP POLICY IF EXISTS "Anon Select Log" ON attendance_log;
DROP POLICY IF EXISTS "Anon Insert Log" ON attendance_log;

-- 3. Crear Políticas permisivas (Permitir TODO a todos por ahora)
-- Para USERS
CREATE POLICY "Anon Select Users" ON attendance_users FOR SELECT USING (true);
CREATE POLICY "Anon Insert Users" ON attendance_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon Update Users" ON attendance_users FOR UPDATE USING (true);

-- Para LOGS
CREATE POLICY "Anon Select Log" ON attendance_log FOR SELECT USING (true);
CREATE POLICY "Anon Insert Log" ON attendance_log FOR INSERT WITH CHECK (true);

-- 4. Verificar
SELECT count(*) as usuarios_registrados FROM attendance_users;
