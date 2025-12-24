-- Add explicit policies to deny anonymous access to sensitive tables

-- 1. PROFILES TABLE: Add policy requiring authentication for all operations
-- Current policies only check auth.uid() = id, but don't explicitly deny anonymous
CREATE POLICY "Require authentication for profiles" 
ON public.profiles
FOR ALL
USING (auth.uid() IS NOT NULL);

-- 2. CHURCHES TABLE: Add policy requiring authentication for all operations  
-- Current policies check leader_id or membership, but don't explicitly deny anonymous
CREATE POLICY "Require authentication for churches"
ON public.churches
FOR ALL
USING (auth.uid() IS NOT NULL);

-- 3. DEPARTMENTS TABLE: Add policy requiring authentication for all operations
-- Current policies check leader_id, but don't explicitly deny anonymous
CREATE POLICY "Require authentication for departments"
ON public.departments
FOR ALL
USING (auth.uid() IS NOT NULL);