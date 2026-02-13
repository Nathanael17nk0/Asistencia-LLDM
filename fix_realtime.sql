-- HABILITAR REALTIME (Para que se actualice solo el celular)
-- Ejecuta esto en SQL Editor de Supabase y dale RUN.

-- 1. Agregar a la publicación "supabase_realtime" las tablas que queremos vigilar
BEGIN;

  -- Para usuarios nuevos
  ALTER PUBLICATION supabase_realtime ADD TABLE attendance_users;

  -- Para asistencias nuevas
  ALTER PUBLICATION supabase_realtime ADD TABLE attendance_log;

COMMIT;

-- 2. Verificar
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
