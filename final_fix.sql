-- ⚠️ NUCLEAR OPTION: RESET ALL PERMISSIONS ⚠️

-- 1. ATTENDANCE USERS
ALTER TABLE public.attendance_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Users" ON public.attendance_users;
CREATE POLICY "Allow All Users" ON public.attendance_users FOR ALL USING (true) WITH CHECK (true);

-- 2. ATTENDANCE LOG
ALTER TABLE public.attendance_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Logs" ON public.attendance_log;
CREATE POLICY "Allow All Logs" ON public.attendance_log FOR ALL USING (true) WITH CHECK (true);

-- 3. ATTENDANCE CONFIG (Schedule & Theme)
ALTER TABLE public.attendance_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Config" ON public.attendance_config;
CREATE POLICY "Allow All Config" ON public.attendance_config FOR ALL USING (true) WITH CHECK (true);

-- 4. GRANT PERMISSIONS TO 'ANON' and 'AUTHENTICATED' ROLES
GRANT ALL ON TABLE public.attendance_users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.attendance_log TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.attendance_config TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. ENSURE REALTIME IS ON
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_config;
