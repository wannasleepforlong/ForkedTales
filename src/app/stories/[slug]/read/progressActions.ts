"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUserId() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, userId: user.id };
}

// --------------------- append a path step + upsert progress ----------------

const stepSchema = z.object({
  storyId: z.string().uuid(),
  slot: z.coerce.number().int().min(0).max(31),
  chapterId: z.string().uuid(),
  choiceId: z.string().uuid().nullable().optional(),
  flags: z.record(z.string(), z.unknown()),
  visitedChapterIds: z.array(z.string().uuid()),
  pickedChoiceIds: z.array(z.string().uuid()),
});

export async function persistStepAction(input: {
  storyId: string;
  slot: number;
  chapterId: string;
  choiceId: string | null;
  flags: Record<string, unknown>;
  visitedChapterIds: string[];
  pickedChoiceIds: string[];
}): Promise<{ ok?: true; error?: string }> {
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad payload." };

  const { supabase, userId } = await requireUserId();

  // Compute next seq for the (user, story, slot).
  const { data: last } = await supabase
    .from("reader_path")
    .select("seq")
    .eq("user_id", userId)
    .eq("story_id", parsed.data.storyId)
    .eq("slot", parsed.data.slot)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSeq = (last?.seq ?? -1) + 1;

  const { error: insErr } = await supabase.from("reader_path").insert({
    user_id: userId,
    story_id: parsed.data.storyId,
    slot: parsed.data.slot,
    seq: nextSeq,
    chapter_id: parsed.data.chapterId,
    choice_id: parsed.data.choiceId ?? null,
    flags_snapshot: parsed.data.flags,
  });
  if (insErr) return { error: insErr.message };

  // Fire analytics events. RLS allows insert when user_id = auth.uid().
  await supabase.from("events").insert([
    {
      user_id: userId,
      story_id: parsed.data.storyId,
      type: "chapter_entered",
      payload: { chapterId: parsed.data.chapterId, slot: parsed.data.slot },
    },
    ...(parsed.data.choiceId
      ? [{
          user_id: userId,
          story_id: parsed.data.storyId,
          type: "choice_picked",
          payload: { choiceId: parsed.data.choiceId, slot: parsed.data.slot },
        }]
      : []),
  ]);

  const { error: upErr } = await supabase.from("reader_progress").upsert(
    {
      user_id: userId,
      story_id: parsed.data.storyId,
      slot: parsed.data.slot,
      current_chapter_id: parsed.data.chapterId,
      visited_chapter_ids: parsed.data.visitedChapterIds,
      picked_choice_ids: parsed.data.pickedChoiceIds,
      flags: parsed.data.flags,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,story_id,slot" },
  );
  if (upErr) return { error: upErr.message };

  return { ok: true };
}

// --------------------- record a discovered ending -------------------------

export async function recordEndingAction(input: {
  storyId: string;
  chapterId: string;
}) {
  const { supabase, userId } = await requireUserId();
  await supabase.from("discovered_endings").upsert({
    user_id: userId,
    story_id: input.storyId,
    chapter_id: input.chapterId,
  });
}

// --------------------- fork a slot (jump-to-node in tree view) ------------

const forkSchema = z.object({
  storyId: z.string().uuid(),
  sourceSlot: z.coerce.number().int().min(0).max(31),
  atSeq: z.coerce.number().int().min(0),
  newSlotName: z.string().max(80).optional(),
});

export async function forkSlotAction(input: {
  storyId: string;
  sourceSlot: number;
  atSeq: number;
  newSlotName?: string;
}): Promise<{ ok?: true; slot?: number; error?: string }> {
  const parsed = forkSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad payload." };

  const { supabase, userId } = await requireUserId();

  // Find the highest slot number for this (user, story).
  const { data: existing } = await supabase
    .from("reader_progress")
    .select("slot")
    .eq("user_id", userId)
    .eq("story_id", parsed.data.storyId);

  const usedSlots = new Set((existing ?? []).map((r) => r.slot as number));
  let newSlot = 0;
  while (usedSlots.has(newSlot)) newSlot++;

  // Copy path rows up to and including atSeq.
  const { data: pathRows, error: readErr } = await supabase
    .from("reader_path")
    .select("seq, chapter_id, choice_id, flags_snapshot")
    .eq("user_id", userId)
    .eq("story_id", parsed.data.storyId)
    .eq("slot", parsed.data.sourceSlot)
    .lte("seq", parsed.data.atSeq)
    .order("seq", { ascending: true });
  if (readErr) return { error: readErr.message };

  if (!pathRows || pathRows.length === 0) return { error: "Nothing to fork from." };

  const cloned = pathRows.map((r) => ({
    user_id: userId,
    story_id: parsed.data.storyId,
    slot: newSlot,
    seq: r.seq,
    chapter_id: r.chapter_id,
    choice_id: r.choice_id,
    flags_snapshot: r.flags_snapshot,
  }));
  const { error: insErr } = await supabase.from("reader_path").insert(cloned);
  if (insErr) return { error: insErr.message };

  const head = pathRows[pathRows.length - 1];
  const visited = Array.from(new Set(pathRows.map((r) => r.chapter_id as string)));
  const picked = pathRows
    .map((r) => r.choice_id as string | null)
    .filter((x): x is string => !!x);

  const { error: upErr } = await supabase.from("reader_progress").upsert(
    {
      user_id: userId,
      story_id: parsed.data.storyId,
      slot: newSlot,
      slot_name: parsed.data.newSlotName ?? `Fork @ ${new Date().toLocaleString()}`,
      current_chapter_id: head.chapter_id,
      visited_chapter_ids: visited,
      picked_choice_ids: picked,
      flags: head.flags_snapshot ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,story_id,slot" },
  );
  if (upErr) return { error: upErr.message };

  return { ok: true, slot: newSlot };
}

// --------------------- delete a slot --------------------------------------

export async function deleteSlotAction(input: {
  storyId: string;
  slot: number;
}) {
  const { supabase, userId } = await requireUserId();
  await supabase
    .from("reader_path")
    .delete()
    .eq("user_id", userId)
    .eq("story_id", input.storyId)
    .eq("slot", input.slot);
  await supabase
    .from("reader_progress")
    .delete()
    .eq("user_id", userId)
    .eq("story_id", input.storyId)
    .eq("slot", input.slot);
}
