-- =========================================================================
-- ALA TEXT: GROUP SYSTEM UPDATE
-- Run this in your Supabase Project's SQL Editor (SQL Editor -> New Query -> Run)
-- =========================================================================

-- 1. Ensure 'created_by' and 'avatar_url' columns exist on public.chats
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Allow updating chats (for group name inline edits & group avatar uploads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chats' AND policyname = 'Allow update chats'
  ) THEN
    CREATE POLICY "Allow update chats" ON public.chats FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 3. Allow deleting chats (for owner deleting group)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chats' AND policyname = 'Allow delete chats'
  ) THEN
    CREATE POLICY "Allow delete chats" ON public.chats FOR DELETE USING (true);
  END IF;
END $$;

-- 4. Allow removing chat participants (for leaving group or owner kicking a member)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_participants' AND policyname = 'Allow delete chat participants'
  ) THEN
    CREATE POLICY "Allow delete chat participants" ON public.chat_participants FOR DELETE USING (true);
  END IF;
END $$;

-- 5. Allow deleting messages (when owner deletes a group)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'messages' AND policyname = 'Allow delete messages'
  ) THEN
    CREATE POLICY "Allow delete messages" ON public.messages FOR DELETE USING (true);
  END IF;
END $$;
