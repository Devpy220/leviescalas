-- Add period_start column to track which half-month period the availability belongs to
ALTER TABLE public.member_availability
ADD COLUMN period_start date NOT NULL DEFAULT (
  CASE 
    WHEN EXTRACT(DAY FROM CURRENT_DATE) >= 16 
    THEN DATE_TRUNC('month', CURRENT_DATE)::date + 15
    ELSE DATE_TRUNC('month', CURRENT_DATE)::date
  END
);

-- Create index for efficient querying by period
CREATE INDEX idx_member_availability_period ON public.member_availability(department_id, period_start);

-- Comment explaining the column
COMMENT ON COLUMN public.member_availability.period_start IS 'Start date of the validity period. Day 1 = first half (1-15), Day 16 = second half (16-end of month)';