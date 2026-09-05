// Shared condition + effect engine. Runs identically on the client (for
// UI gating) and the server (for authoritative unlocks and jumps). Keep
// this module dependency-free so both sides import it cleanly.

import type { ConditionNode, Cmp, Effect } from "@/lib/types";

export interface ConditionCtx {
  visitedChapterIds: Set<string>;
  pickedChoiceIds: Set<string>;
  discoveredEndings: Set<string>;
  flags: Record<string, unknown>;
}

export function makeCtx(partial: Partial<ConditionCtx> = {}): ConditionCtx {
  return {
    visitedChapterIds: partial.visitedChapterIds ?? new Set(),
    pickedChoiceIds: partial.pickedChoiceIds ?? new Set(),
    discoveredEndings: partial.discoveredEndings ?? new Set(),
    flags: partial.flags ?? {},
  };
}

/**
 * A null / undefined condition means "no gating" — always true. This is
 * the convention throughout the reader and editor.
 */
export function evaluate(
  node: ConditionNode | null | undefined,
  ctx: ConditionCtx,
): boolean {
  if (!node) return true;
  switch (node.op) {
    case "and":
      return node.children.every((c) => evaluate(c, ctx));
    case "or":
      return node.children.some((c) => evaluate(c, ctx));
    case "not":
      return !evaluate(node.child, ctx);
    case "visited":
      return ctx.visitedChapterIds.has(node.chapterId);
    case "chose":
      return ctx.pickedChoiceIds.has(node.choiceId);
    case "endingReached":
      return ctx.discoveredEndings.has(node.chapterId);
    case "flag": {
      const actual = ctx.flags[node.key];
      return compare(actual, node.cmp, node.value);
    }
    default: {
      // Exhaustiveness guard — if a new op is added and forgotten here,
      // the compiler will complain.
      const _never: never = node;
      void _never;
      return false;
    }
  }
}

function compare(a: unknown, cmp: Cmp, b: unknown): boolean {
  // Booleans and strings only support ==/!=; numeric comparisons coerce.
  if (cmp === "==") return looseEq(a, b);
  if (cmp === "!=") return !looseEq(a, b);
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  switch (cmp) {
    case "<":  return na <  nb;
    case "<=": return na <= nb;
    case ">":  return na >  nb;
    case ">=": return na >= nb;
  }
  return false;
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
  return String(a) === String(b);
}

// --------------------------- Effects ---------------------------------------

export function applyEffects(
  effects: Effect[] | null | undefined,
  flags: Record<string, unknown>,
): Record<string, unknown> {
  if (!effects || effects.length === 0) return flags;
  const next = { ...flags };
  for (const eff of effects) {
    switch (eff.op) {
      case "setFlag":
        next[eff.key] = eff.value;
        break;
      case "incFlag": {
        const cur = Number(next[eff.key] ?? 0);
        next[eff.key] = (Number.isFinite(cur) ? cur : 0) + eff.by;
        break;
      }
      case "unlockEnding":
        // Recorded via discovered_endings, not stored on flags.
        break;
      default: {
        const _never: never = eff;
        void _never;
      }
    }
  }
  return next;
}

// --------------------------- Describe (for the UI) -------------------------

export function describeCondition(
  node: ConditionNode | null | undefined,
  labels: {
    chapters?: Record<string, string>;
    choices?: Record<string, string>;
  } = {},
): string {
  if (!node) return "always";
  switch (node.op) {
    case "and":
      return node.children.map((c) => describeCondition(c, labels)).join(" AND ");
    case "or":
      return node.children.map((c) => describeCondition(c, labels)).join(" OR ");
    case "not":
      return `NOT (${describeCondition(node.child, labels)})`;
    case "visited":
      return `visited ${labels.chapters?.[node.chapterId] ?? "chapter"}`;
    case "chose":
      return `chose ${labels.choices?.[node.choiceId] ?? "choice"}`;
    case "endingReached":
      return `ending ${labels.chapters?.[node.chapterId] ?? "?"} reached`;
    case "flag":
      return `${node.key} ${node.cmp} ${JSON.stringify(node.value)}`;
  }
}
