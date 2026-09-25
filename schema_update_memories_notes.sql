-- Run this SQL in your Supabase Project's SQL Editor:
-- Adds permanent database tables for Chat Memories and Notes & Vault.

-- 1. Create chat_memories table
CREATE TABLE IF NOT EXISTS public.chat_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  caption TEXT,
  media_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'text', -- 'image' | 'video' | 'audio' | 'text'
  original_message_id UUID,
  memory_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_vault BOOLEAN NOT NULL DEFAULT false,
  location_name TEXT,
  milestone_tag TEXT
);

-- Ensure columns exist if table was already created earlier:
ALTER TABLE public.chat_memories ADD COLUMN IF NOT EXISTS is_vault BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chat_memories ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE public.chat_memories ADD COLUMN IF NOT EXISTS milestone_tag TEXT;

-- 2. Create chat_notes table
CREATE TABLE IF NOT EXISTS public.chat_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_vault BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#5865F2',
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note_type TEXT NOT NULL DEFAULT 'text',
  checklist_items JSONB DEFAULT '[]'::jsonb
);

-- Ensure columns exist if table was already created earlier:
ALTER TABLE public.chat_notes ADD COLUMN IF NOT EXISTS note_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE public.chat_notes ADD COLUMN IF NOT EXISTS checklist_items JSONB DEFAULT '[]'::jsonb;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.chat_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_notes ENABLE ROW LEVEL SECURITY;


-- 4. RLS Policies for chat_memories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_memories' AND policyname = 'Participants can view chat memories'
  ) THEN
    CREATE POLICY "Participants can view chat memories" ON public.chat_memories
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.chat_participants
          WHERE chat_participants.chat_id = chat_memories.chat_id
          AND chat_participants.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_memories' AND policyname = 'Participants can insert chat memories'
  ) THEN
    CREATE POLICY "Participants can insert chat memories" ON public.chat_memories
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.chat_participants
          WHERE chat_participants.chat_id = chat_memories.chat_id
          AND chat_participants.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_memories' AND policyname = 'Creators can delete chat memories'
  ) THEN
    CREATE POLICY "Creators can delete chat memories" ON public.chat_memories
      FOR DELETE USING (
        created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.chat_participants
          WHERE chat_participants.chat_id = chat_memories.chat_id
          AND chat_participants.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 5. RLS Policies for chat_notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_notes' AND policyname = 'Participants can view chat notes'
  ) THEN
    CREATE POLICY "Participants can view chat notes" ON public.chat_notes
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.chat_participants
          WHERE chat_participants.chat_id = chat_notes.chat_id
          AND chat_participants.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_notes' AND policyname = 'Participants can insert chat notes'
  ) THEN
    CREATE POLICY "Participants can insert chat notes" ON public.chat_notes
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.chat_participants
          WHERE chat_participants.chat_id = chat_notes.chat_id
          AND chat_participants.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_notes' AND policyname = 'Participants can update chat notes'
  ) THEN
    CREATE POLICY "Participants can update chat notes" ON public.chat_notes
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.chat_participants
          WHERE chat_participants.chat_id = chat_notes.chat_id
          AND chat_participants.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_notes' AND policyname = 'Participants can delete chat notes'
  ) THEN
    CREATE POLICY "Participants can delete chat notes" ON public.chat_notes
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.chat_participants
          WHERE chat_participants.chat_id = chat_notes.chat_id
          AND chat_participants.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 6. Indexes for speed
CREATE INDEX IF NOT EXISTS idx_chat_memories_chat_id ON public.chat_memories(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_notes_chat_id ON public.chat_notes(chat_id);
