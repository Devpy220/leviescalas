-- 1. Add 'coleader' value to member_role enum
ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'coleader';
