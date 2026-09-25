import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export interface MemoryItem {
  id: string;
  chat_id: string;
  created_by: string;
  title?: string;
  caption?: string;
  media_url?: string | null;
  media_type: 'image' | 'video' | 'audio' | 'text';
  original_message_id?: string | null;
  memory_date: string;
  created_at: string;
  sender_name?: string;
  is_vault?: boolean;
  location_name?: string;
  milestone_tag?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface NoteItem {
  id: string;
  chat_id: string;
  created_by: string;
  title: string;
  content: string;
  is_vault: boolean;
  color?: string;
  pinned?: boolean;
  created_at: string;
  updated_at: string;
  note_type?: 'text' | 'checklist';
  checklist_items?: ChecklistItem[];
}

// -------------------------------------------------------------
// LOCAL CACHING HELPERS
// -------------------------------------------------------------
export async function loadMemoriesFromLocal(chatId: string): Promise<MemoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(`@chat_${chatId}_memories`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export async function saveMemoriesToLocal(chatId: string, memories: MemoryItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`@chat_${chatId}_memories`, JSON.stringify(memories));
  } catch (e) {}
}

export async function loadNotesFromLocal(chatId: string): Promise<NoteItem[]> {
  try {
    const raw = await AsyncStorage.getItem(`@chat_${chatId}_notes`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export async function saveNotesToLocal(chatId: string, notes: NoteItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`@chat_${chatId}_notes`, JSON.stringify(notes));
  } catch (e) {}
}

// -------------------------------------------------------------
// MEMORIES API
// -------------------------------------------------------------
export async function fetchMemories(chatId: string): Promise<MemoryItem[]> {
  const local = await loadMemoriesFromLocal(chatId);
  try {
    const { data, error } = await supabase
      .from("chat_memories")
      .select("*")
      .eq("chat_id", chatId)
      .order("memory_date", { ascending: false });

    if (!error && Array.isArray(data)) {
      await saveMemoriesToLocal(chatId, data);
      return data;
    }
  } catch (e) {}
  return local;
}

export async function addMemory(
  chatId: string,
  userId: string,
  item: {
    title?: string;
    caption?: string;
    media_url?: string | null;
    media_type: 'image' | 'video' | 'audio' | 'text';
    original_message_id?: string | null;
    memory_date?: string;
    sender_name?: string;
    is_vault?: boolean;
    location_name?: string;
    milestone_tag?: string;
  }
): Promise<MemoryItem> {
  const newMemory: MemoryItem = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    chat_id: chatId,
    created_by: userId,
    title: item.title || (item.media_type === "image" ? "Saved Photo" : item.media_type === "audio" ? "Voice Note" : "Special Moment"),
    caption: item.caption || "",
    media_url: item.media_url || null,
    media_type: item.media_type,
    original_message_id: item.original_message_id || null,
    memory_date: item.memory_date || new Date().toISOString(),
    created_at: new Date().toISOString(),
    sender_name: item.sender_name,
    is_vault: item.is_vault ?? false,
    location_name: item.location_name || undefined,
    milestone_tag: item.milestone_tag || undefined,
  };

  // 1. Optimistic local cache update
  const current = await loadMemoriesFromLocal(chatId);
  const updated = [newMemory, ...current];
  await saveMemoriesToLocal(chatId, updated);

  // 2. Cloud insert
  try {
    const payload: any = {
      chat_id: chatId,
      created_by: userId,
      title: newMemory.title,
      caption: newMemory.caption,
      media_url: newMemory.media_url,
      media_type: newMemory.media_type,
      original_message_id: newMemory.original_message_id,
      memory_date: newMemory.memory_date,
      is_vault: newMemory.is_vault,
      location_name: newMemory.location_name,
      milestone_tag: newMemory.milestone_tag,
    };

    let { data, error } = await supabase.from("chat_memories").insert(payload).select().single();

    // Fallback if extra columns don't exist yet on DB
    if (error) {
      delete payload.is_vault;
      delete payload.location_name;
      delete payload.milestone_tag;
      const res = await supabase.from("chat_memories").insert(payload).select().single();
      data = res.data;
      error = res.error;
    }

    if (!error && data) {
      const finalMem: MemoryItem = { ...newMemory, id: data.id };
      const finalized = [finalMem, ...current.filter(m => m.id !== newMemory.id)];
      await saveMemoriesToLocal(chatId, finalized);
      broadcastMemoriesUpdate(chatId);
      return finalMem;
    }
  } catch (e) {}

  broadcastMemoriesUpdate(chatId);
  return newMemory;
}

export async function deleteMemory(chatId: string, memoryId: string): Promise<void> {
  const current = await loadMemoriesFromLocal(chatId);
  const filtered = current.filter(m => m.id !== memoryId);
  await saveMemoriesToLocal(chatId, filtered);

  try {
    await supabase.from("chat_memories").delete().eq("id", memoryId);
  } catch (e) {}

  broadcastMemoriesUpdate(chatId);
}

// -------------------------------------------------------------
// NOTES & VAULT API
// -------------------------------------------------------------
export async function fetchNotes(chatId: string): Promise<NoteItem[]> {
  const local = await loadNotesFromLocal(chatId);
  try {
    const { data, error } = await supabase
      .from("chat_notes")
      .select("*")
      .eq("chat_id", chatId)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      await saveNotesToLocal(chatId, data);
      return data;
    }
  } catch (e) {}
  return local;
}

export async function saveNote(
  chatId: string,
  userId: string,
  note: {
    id?: string;
    title: string;
    content: string;
    is_vault?: boolean;
    color?: string;
    pinned?: boolean;
    note_type?: 'text' | 'checklist';
    checklist_items?: ChecklistItem[];
  }
): Promise<NoteItem> {
  const isExisting = !!note.id;
  const noteId = note.id || `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const currentNotes = await loadNotesFromLocal(chatId);
  let updatedNote: NoteItem;

  if (isExisting) {
    const existing = currentNotes.find(n => n.id === noteId);
    updatedNote = {
      id: noteId,
      chat_id: chatId,
      created_by: existing?.created_by || userId,
      title: note.title,
      content: note.content,
      is_vault: note.is_vault ?? existing?.is_vault ?? false,
      color: note.color || existing?.color || "#5865F2",
      pinned: note.pinned ?? existing?.pinned ?? false,
      note_type: note.note_type || existing?.note_type || 'text',
      checklist_items: note.checklist_items || existing?.checklist_items || [],
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    const updatedList = currentNotes.map(n => n.id === noteId ? updatedNote : n);
    await saveNotesToLocal(chatId, updatedList);
  } else {
    updatedNote = {
      id: noteId,
      chat_id: chatId,
      created_by: userId,
      title: note.title,
      content: note.content,
      is_vault: note.is_vault ?? false,
      color: note.color || "#5865F2",
      pinned: note.pinned ?? false,
      note_type: note.note_type || 'text',
      checklist_items: note.checklist_items || [],
      created_at: now,
      updated_at: now,
    };
    await saveNotesToLocal(chatId, [updatedNote, ...currentNotes]);
  }

  // Cloud persistence
  try {
    const dbPayload: any = {
      title: updatedNote.title,
      content: updatedNote.content,
      is_vault: updatedNote.is_vault,
      color: updatedNote.color,
      pinned: updatedNote.pinned,
      note_type: updatedNote.note_type,
      checklist_items: updatedNote.checklist_items,
      updated_at: now,
    };

    if (isExisting) {
      let { error } = await supabase.from("chat_notes").update(dbPayload).eq("id", noteId);
      if (error) {
        delete dbPayload.note_type;
        delete dbPayload.checklist_items;
        await supabase.from("chat_notes").update(dbPayload).eq("id", noteId);
      }
    } else {
      let { data, error } = await supabase.from("chat_notes").insert({
        chat_id: chatId,
        created_by: userId,
        ...dbPayload,
      }).select().single();

      if (error) {
        delete dbPayload.note_type;
        delete dbPayload.checklist_items;
        const res = await supabase.from("chat_notes").insert({
          chat_id: chatId,
          created_by: userId,
          ...dbPayload,
        }).select().single();
        data = res.data;
      }

      if (data) {
        updatedNote.id = data.id;
        const currentNow = await loadNotesFromLocal(chatId);
        const replaced = currentNow.map(n => n.id === noteId ? updatedNote : n);
        await saveNotesToLocal(chatId, replaced);
      }
    }
  } catch (e) {}

  broadcastNotesUpdate(chatId);
  return updatedNote;
}

export async function toggleChecklistItem(chatId: string, noteId: string, itemId: string): Promise<NoteItem | null> {
  const currentNotes = await loadNotesFromLocal(chatId);
  const note = currentNotes.find(n => n.id === noteId);
  if (!note || !note.checklist_items) return null;

  const updatedItems = note.checklist_items.map(it =>
    it.id === itemId ? { ...it, done: !it.done } : it
  );

  const updatedNote: NoteItem = {
    ...note,
    checklist_items: updatedItems,
    updated_at: new Date().toISOString(),
  };

  const updatedList = currentNotes.map(n => n.id === noteId ? updatedNote : n);
  await saveNotesToLocal(chatId, updatedList);

  // Sync to DB
  try {
    await supabase.from("chat_notes").update({
      checklist_items: updatedItems,
      updated_at: updatedNote.updated_at,
    }).eq("id", noteId);
  } catch (e) {}

  broadcastNotesUpdate(chatId);
  return updatedNote;
}

export async function deleteNote(chatId: string, noteId: string): Promise<void> {
  const current = await loadNotesFromLocal(chatId);
  const filtered = current.filter(n => n.id !== noteId);
  await saveNotesToLocal(chatId, filtered);

  try {
    await supabase.from("chat_notes").delete().eq("id", noteId);
  } catch (e) {}

  broadcastNotesUpdate(chatId);
}

// -------------------------------------------------------------
// REALTIME BROADCAST CHANNELS
// -------------------------------------------------------------
export function broadcastMemoriesUpdate(chatId: string): void {
  try {
    const topic = `chat_broadcast_${chatId}`;
    const channel = supabase.channel(topic);
    channel.send({
      type: "broadcast",
      event: "memories_updated",
      payload: { chatId, timestamp: Date.now() },
    });
  } catch (e) {}
}

export function broadcastNotesUpdate(chatId: string): void {
  try {
    const topic = `chat_broadcast_${chatId}`;
    const channel = supabase.channel(topic);
    channel.send({
      type: "broadcast",
      event: "notes_updated",
      payload: { chatId, timestamp: Date.now() },
    });
  } catch (e) {}
}
