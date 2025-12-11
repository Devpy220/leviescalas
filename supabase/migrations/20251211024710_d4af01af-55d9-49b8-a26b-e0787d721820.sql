-- Add read_at column to notifications table for tracking read status
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS read_at timestamp with time zone DEFAULT NULL;

-- Create index for faster queries on unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON public.notifications (user_id, read_at) 
WHERE read_at IS NULL;