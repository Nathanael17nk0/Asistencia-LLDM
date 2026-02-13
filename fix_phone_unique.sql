-- PERMITIR CELULARES REPETIDOS
-- (Para familias que comparten celular o re-inscripciones)

-- Borrar la restricción de "Único" en el teléfono
ALTER TABLE attendance_users DROP CONSTRAINT IF EXISTS attendance_users_phone_key;

-- También verificar si hay índice único y borrarlo si es necesario
DROP INDEX IF EXISTS attendance_users_phone_key;

-- Opcional: Asegurar que email tampoco sea único si se usa
ALTER TABLE attendance_users DROP CONSTRAINT IF EXISTS attendance_users_email_key;
