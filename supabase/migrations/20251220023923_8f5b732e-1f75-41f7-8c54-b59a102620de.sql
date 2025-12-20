-- Add email, phone and cnpj columns to churches table
ALTER TABLE public.churches
ADD COLUMN email text,
ADD COLUMN phone text,
ADD COLUMN cnpj text;