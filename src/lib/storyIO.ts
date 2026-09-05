// Story JSON round-tripping. Serialization uses a stable schemaVersion so
// import can detect and (eventually) migrate older exports.

import type { StoryGraph } from "@/lib/storyGraph";
import type { ConditionNode, Effect } from "@/lib/types";
import { z } from "zod";

export const CURRENT_EXPORT_VERSION = 1;

export interface StoryExport {
  schemaVersion: number;
  story: {
    slug: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    contentRating?: string;
    status?: string;
    tags?: string[];
    warnings?: string[];
  };
  flagDefs: StoryGraph["flagDefs"];
  chapters: Array<{
    localId: string; // stable id inside the file; not the DB uuid
    title: string;
    order: number;
    isEnding: boolean;
    endingLabel: string | null;
    draft: boolean;
    unlockCondition: ConditionNode | null;
    blocks: StoryGraph["chapters"][number]["blocks"];
  }>;
  choices: Array<{
    localId: string;
    fromLocalId: string;
    targetLocalId: string | null;
    label: string;
    order: number;
    showCondition: ConditionNode | null;
    effects: Effect[];
  }>;
  startLocalId: string | null;
}

export function graphToExport(g: StoryGraph, extras: {
  contentRating?: string;
  status?: string;
  tags?: string[];
  warnings?: string[];
}): StoryExport {
  // Assign compact stable local ids so the file doesn't leak internal UUIDs
  // and can be re-imported into any story.
  const idMap = new Map<string, string>();
  g.chapters.forEach((c, i) => idMap.set(c.id, `c${i + 1}`));
  const choiceIdMap = new Map<string, string>();
  g.choices.forEach((ch, i) => choiceIdMap.set(ch.id, `x${i + 1}`));

  const remapCondition = (n: ConditionNode | null): ConditionNode | null => {
    if (!n) return null;
    switch (n.op) {
      case "and":
      case "or":
        return { op: n.op, children: n.children.map((c) => remapCondition(c) as ConditionNode).filter(Boolean) };
      case "not":
        return { op: "not", child: remapCondition(n.child) as ConditionNode };
      case "visited":
      case "endingReached":
        return { ...n, chapterId: idMap.get(n.chapterId) ?? n.chapterId };
      case "chose":
        return { ...n, choiceId: choiceIdMap.get(n.choiceId) ?? n.choiceId };
      case "flag":
        return n;
    }
  };
  const remapEffects = (effects: Effect[]): Effect[] =>
    effects.map((e) =>
      e.op === "unlockEnding" ? { ...e, chapterId: idMap.get(e.chapterId) ?? e.chapterId } : e,
    );

  return {
    schemaVersion: CURRENT_EXPORT_VERSION,
    story: {
      slug: g.story.slug,
      title: g.story.title,
      description: g.story.description,
      coverUrl: g.story.coverUrl,
      ...extras,
    },
    flagDefs: g.flagDefs,
    chapters: g.chapters.map((c) => ({
      localId: idMap.get(c.id)!,
      title: c.title,
      order: c.order,
      isEnding: c.isEnding,
      endingLabel: c.endingLabel,
      draft: c.draft,
      unlockCondition: remapCondition(c.unlockCondition),
      blocks: c.blocks,
    })),
    choices: g.choices.map((ch) => ({
      localId: choiceIdMap.get(ch.id)!,
      fromLocalId: idMap.get(ch.fromChapterId)!,
      targetLocalId: ch.targetChapterId ? idMap.get(ch.targetChapterId) ?? null : null,
      label: ch.label,
      order: ch.order,
      showCondition: remapCondition(ch.showCondition),
      effects: remapEffects(ch.effects),
    })),
    startLocalId: g.story.startChapterId ? idMap.get(g.story.startChapterId) ?? null : null,
  };
}

// Lenient validator — imports may come from older versions.
export const importSchema = z.object({
  schemaVersion: z.number().int(),
  story: z.object({
    slug: z.string().min(1).optional(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    coverUrl: z.string().nullable().optional(),
    contentRating: z.enum(["everyone", "teen", "mature"]).optional(),
    status: z.enum(["draft", "ongoing", "complete"]).optional(),
    tags: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
  }),
  flagDefs: z.array(z.any()).default([]),
  chapters: z.array(
    z.object({
      localId: z.string(),
      title: z.string(),
      order: z.number().int(),
      isEnding: z.boolean().default(false),
      endingLabel: z.string().nullable().optional(),
      draft: z.boolean().default(true),
      unlockCondition: z.any().nullable().optional(),
      blocks: z.array(z.any()).default([]),
    }),
  ),
  choices: z.array(
    z.object({
      localId: z.string(),
      fromLocalId: z.string(),
      targetLocalId: z.string().nullable().optional(),
      label: z.string(),
      order: z.number().int(),
      showCondition: z.any().nullable().optional(),
      effects: z.array(z.any()).default([]),
    }),
  ),
  startLocalId: z.string().nullable().optional(),
});

export type StoryImport = z.infer<typeof importSchema>;
