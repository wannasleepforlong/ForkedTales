// Story linter. Runs across the full published + draft graph and returns
// a list of issues sorted by severity. Pure and dep-free — safe to use
// on either client or server.

import type { ConditionNode, Effect } from "@/lib/types";

export type LintSeverity = "error" | "warn" | "info";
export interface LintIssue {
  severity: LintSeverity;
  code: string;
  message: string;
  chapterId?: string;
  choiceId?: string;
}

export interface LintInput {
  startChapterId: string | null;
  chapters: Array<{
    id: string;
    title: string;
    isEnding: boolean;
    draft: boolean;
    unlockCondition: ConditionNode | null;
  }>;
  choices: Array<{
    id: string;
    fromChapterId: string;
    targetChapterId: string | null;
    label: string;
    showCondition: ConditionNode | null;
    effects: Effect[];
  }>;
  flagKeys: string[];
}

export function lintStory(input: LintInput): LintIssue[] {
  const issues: LintIssue[] = [];
  const chapterIds = new Set(input.chapters.map((c) => c.id));
  const choiceIds = new Set(input.choices.map((c) => c.id));
  const flagSet = new Set(input.flagKeys);
  const outByChapter: Record<string, typeof input.choices> = {};
  for (const c of input.chapters) outByChapter[c.id] = [];
  for (const ch of input.choices) outByChapter[ch.fromChapterId]?.push(ch);

  // 1. start chapter set?
  if (!input.startChapterId) {
    issues.push({
      severity: "error",
      code: "no-start",
      message: "Story has no start chapter. Set one on the story details.",
    });
  } else if (!chapterIds.has(input.startChapterId)) {
    issues.push({
      severity: "error",
      code: "bad-start",
      message: "Start chapter id points at a chapter that no longer exists.",
    });
  }

  // 2. reachability from start (via choices, ignoring conditions).
  const reachable = new Set<string>();
  if (input.startChapterId && chapterIds.has(input.startChapterId)) {
    const q = [input.startChapterId];
    reachable.add(input.startChapterId);
    while (q.length) {
      const id = q.shift()!;
      for (const ch of outByChapter[id] ?? []) {
        if (ch.targetChapterId && !reachable.has(ch.targetChapterId) && chapterIds.has(ch.targetChapterId)) {
          reachable.add(ch.targetChapterId);
          q.push(ch.targetChapterId);
        }
      }
    }
  }
  for (const c of input.chapters) {
    if (!reachable.has(c.id)) {
      issues.push({
        severity: "warn",
        code: "unreachable-chapter",
        message: `Chapter "${c.title}" is not reachable from the start.`,
        chapterId: c.id,
      });
    }
  }

  // 3. dead-end chapters: not ending, no outbound choices, and reachable.
  for (const c of input.chapters) {
    if (!c.isEnding && reachable.has(c.id) && (outByChapter[c.id] ?? []).length === 0) {
      issues.push({
        severity: "warn",
        code: "dead-end",
        message: `Chapter "${c.title}" has no choices and is not marked as an ending.`,
        chapterId: c.id,
      });
    }
  }

  // 4. choices with no target.
  for (const ch of input.choices) {
    if (!ch.targetChapterId) {
      issues.push({
        severity: "warn",
        code: "choice-no-target",
        message: `Choice "${ch.label || "(untitled)"}" has no target chapter.`,
        choiceId: ch.id,
      });
    } else if (!chapterIds.has(ch.targetChapterId)) {
      issues.push({
        severity: "error",
        code: "choice-bad-target",
        message: `Choice "${ch.label || "(untitled)"}" targets a chapter that no longer exists.`,
        choiceId: ch.id,
      });
    }
  }

  // 5. condition / effect reference sanity.
  function walkCondition(node: ConditionNode | null | undefined, ctx: { chapterId?: string; choiceId?: string }) {
    if (!node) return;
    switch (node.op) {
      case "and":
      case "or":
        node.children.forEach((c) => walkCondition(c, ctx));
        break;
      case "not":
        walkCondition(node.child, ctx);
        break;
      case "visited":
      case "endingReached":
        if (!chapterIds.has(node.chapterId)) {
          issues.push({
            severity: "error",
            code: "cond-missing-chapter",
            message: `Condition references a missing chapter.`,
            ...ctx,
          });
        }
        break;
      case "chose":
        if (!choiceIds.has(node.choiceId)) {
          issues.push({
            severity: "error",
            code: "cond-missing-choice",
            message: `Condition references a missing choice.`,
            ...ctx,
          });
        }
        break;
      case "flag":
        if (!flagSet.has(node.key)) {
          issues.push({
            severity: "info",
            code: "cond-undeclared-flag",
            message: `Condition references undeclared flag "${node.key}".`,
            ...ctx,
          });
        }
        break;
    }
  }
  for (const c of input.chapters) walkCondition(c.unlockCondition, { chapterId: c.id });
  for (const ch of input.choices) {
    walkCondition(ch.showCondition, { chapterId: ch.fromChapterId, choiceId: ch.id });
    for (const eff of ch.effects) {
      if ((eff.op === "setFlag" || eff.op === "incFlag") && !flagSet.has(eff.key)) {
        issues.push({
          severity: "info",
          code: "eff-undeclared-flag",
          message: `Effect on "${ch.label}" writes undeclared flag "${eff.key}".`,
          choiceId: ch.id,
        });
      }
      if (eff.op === "unlockEnding" && !chapterIds.has(eff.chapterId)) {
        issues.push({
          severity: "error",
          code: "eff-bad-ending",
          message: `Effect on "${ch.label}" unlocks a missing ending chapter.`,
          choiceId: ch.id,
        });
      }
    }
  }

  // 6. endings should be reachable.
  for (const c of input.chapters) {
    if (c.isEnding && !reachable.has(c.id)) {
      issues.push({
        severity: "warn",
        code: "ending-unreachable",
        message: `Ending "${c.title}" is not reachable from any choice.`,
        chapterId: c.id,
      });
    }
  }

  // 7. non-empty publishing check — a story with only draft chapters
  // publishes to nothing.
  const publishedCount = input.chapters.filter((c) => !c.draft).length;
  if (publishedCount === 0) {
    issues.push({
      severity: "warn",
      code: "no-published-chapters",
      message: "All chapters are drafts; readers will see nothing.",
    });
  }

  const order: Record<LintSeverity, number> = { error: 0, warn: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  return issues;
}
