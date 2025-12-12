-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false);

-- RLS policies for payment-receipts bucket
-- Users can upload their own receipts
CREATE POLICY "Users can upload payment receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own receipts
CREATE POLICY "Users can view own payment receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Leaders can view all receipts (for verification)
CREATE POLICY "Leaders can view all payment receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts' AND 
  EXISTS (
    SELECT 1 FROM public.members 
    WHERE user_id = auth.uid() AND role = 'leader'
  )
);

-- Create table to track payment receipts
CREATE TABLE public.payment_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  receipt_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- Users can view their own receipts
CREATE POLICY "Users can view own receipts"
ON public.payment_receipts FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own receipts
CREATE POLICY "Users can insert own receipts"
ON public.payment_receipts FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Leaders can view receipts for their departments
CREATE POLICY "Leaders can view department receipts"
ON public.payment_receipts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.departments 
    WHERE id = department_id AND leader_id = auth.uid()
  )
);

-- Leaders can update receipt status for their departments
CREATE POLICY "Leaders can update department receipt status"
ON public.payment_receipts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.departments 
    WHERE id = department_id AND leader_id = auth.uid()
  )
);