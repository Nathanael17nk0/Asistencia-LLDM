-- AGREGAR COLUMNAS FALTANTES PARA EL REGISTRO DETALLADO
-- Ejecuta esto en el SQL Editor de Supabase
-- Copia y pega y dale RUN.

-- 1. Agregar columna Fecha de Nacimiento (dob)
ALTER TABLE attendance_users 
ADD COLUMN IF NOT EXISTS dob TEXT; 
-- (Usamos TEXT para evitar problemas de formato fecha ahora, o DATE si prefieres estricto)
-- Mejor DATE para futuro.
ALTER TABLE attendance_users DROP COLUMN IF EXISTS dob; -- Por si acaso existía mal
ALTER TABLE attendance_users ADD COLUMN dob DATE;

-- 2. Agregar columna Edad (age)
ALTER TABLE attendance_users 
ADD COLUMN IF NOT EXISTS age TEXT;

-- 3. Agregar columna Colonia (colony)
-- NOTA: En el codigo JS se llama 'colony' (ver supabase-service.js), pero en el objeto local era 'colonia'.
-- El servicio supabase-service.js mapea `colony: user.colonia`.
-- Así que en la DB debe llamarse 'colony'.
ALTER TABLE attendance_users 
ADD COLUMN IF NOT EXISTS colony TEXT;

-- 4. Verificar que se crearon
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attendance_users';
