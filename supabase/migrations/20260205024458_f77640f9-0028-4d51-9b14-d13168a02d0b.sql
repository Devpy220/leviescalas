-- Ensure expected privileges for PostgREST roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- (Optional) keep anon without access to profiles (PII)
REVOKE ALL ON TABLE public.profiles FROM anon;
