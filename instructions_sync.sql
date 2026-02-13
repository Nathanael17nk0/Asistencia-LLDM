-- Create a Config/Key-Value Store Table
CREATE TABLE public.attendance_config (
    key text PRIMARY KEY,
    value jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_config;

-- Policies
ALTER TABLE public.attendance_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for config" ON public.attendance_config FOR ALL USING (true) WITH CHECK (true);
