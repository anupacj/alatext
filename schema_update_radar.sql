-- Run this SQL in your Supabase Project's SQL Editor (optional, fallback table already active):
-- Adds permanent database column for Couple Compass & Distance Radar location.

ALTER TABLE public.chat_participants ADD COLUMN IF NOT EXISTS radar_location JSONB;

-- Ensure RLS policy allows updating your own participant record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_participants' AND policyname = 'Users can update their own chat settings'
  ) THEN
    CREATE POLICY "Users can update their own chat settings" 
    ON public.chat_participants FOR UPDATE 
    USING (user_id = auth.uid());
  END IF;
END $$;
