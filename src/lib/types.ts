// Shared domain types. The block, condition, and effect shapes are the
// single source of truth for both the reader runtime and the author editor.

export type Uuid = string;

// ------------------------------ Blocks -------------------------------------

export type BlockType =
  | "narration"
  | "dialogue"
  | "background"   // { image, transition?: "cut" | "fade" }
  | "sprite"       // { image, side: "left"|"center"|"right", show|hide }
  | "sfx"          // { url }
  | "bgm.play"     // { track, loop?: true, fadeMs?: number, volume?: 0..1 }
  | "bgm.change"   // { track, fadeMs?: number, volume?: 0..1 }
  | "bgm.stop"     // { fadeMs?: number }
  | "wait"         // { ms }
  | "flagSet"      // { key, value } | { key, inc }
  | "choicePrompt";

export interface Block {
  id: Uuid;
  chapterId: Uuid;
  order: number;
  type: BlockType;
  data: Record<string, unknown>;
}

// ---------------------------- Conditions -----------------------------------

export type Cmp = "==" | "!=" | "<" | "<=" | ">" | ">=";

export type ConditionNode =
  | { op: "and"; children: ConditionNode[] }
  | { op: "or"; children: ConditionNode[] }
  | { op: "not"; child: ConditionNode }
  | { op: "visited"; chapterId: Uuid }
  | { op: "chose"; choiceId: Uuid }
  | { op: "flag"; key: string; cmp: Cmp; value: string | number | boolean }
  | { op: "endingReached"; chapterId: Uuid };

// ------------------------------ Effects ------------------------------------

export type Effect =
  | { op: "setFlag"; key: string; value: string | number | boolean }
  | { op: "incFlag"; key: string; by: number }
  | { op: "unlockEnding"; chapterId: Uuid };

// ----------------------------- Entities ------------------------------------

export interface Story {
  id: Uuid;
  authorId: Uuid;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  tags: string[];
  contentRating: "everyone" | "teen" | "mature";
  warnings: string[];
  status: "draft" | "ongoing" | "complete";
  startChapterId: Uuid | null;
  schemaVersion: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: Uuid;
  storyId: Uuid;
  title: string;
  order: number;
  isEnding: boolean;
  endingLabel: string | null;
  unlockCondition: ConditionNode | null;
  draft: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Choice {
  id: Uuid;
  fromChapterId: Uuid;
  targetChapterId: Uuid | null;
  label: string;
  order: number;
  showCondition: ConditionNode | null;
  effects: Effect[];
}

export interface FlagDef {
  id: Uuid;
  storyId: Uuid;
  key: string;
  kind: "bool" | "int" | "string" | "enum";
  defaultValue: unknown;
  description: string | null;
  enumValues: string[] | null;
}

export interface ReaderProgress {
  id: Uuid;
  userId: Uuid;
  storyId: Uuid;
  slot: number;
  slotName: string | null;
  currentChapterId: Uuid | null;
  visitedChapterIds: Uuid[];
  pickedChoiceIds: Uuid[];
  flags: Record<string, unknown>;
  updatedAt: string;
}

export interface ReaderPathStep {
  id: Uuid;
  userId: Uuid;
  storyId: Uuid;
  slot: number;
  seq: number;
  chapterId: Uuid;
  choiceId: Uuid | null;
  flagsSnapshot: Record<string, unknown>;
  at: string;
}
