"use client";

import type { ConditionNode, Cmp } from "@/lib/types";

type ChapterOpt = { id: string; title: string };
type ChoiceOpt = { id: string; label: string; chapterTitle?: string };

const CMPS: Cmp[] = ["==", "!=", "<", "<=", ">", ">="];
const OPS: { value: ConditionNode["op"] | "none"; label: string }[] = [
  { value: "none", label: "— always true —" },
  { value: "and", label: "AND (all)" },
  { value: "or", label: "OR (any)" },
  { value: "not", label: "NOT" },
  { value: "visited", label: "Visited chapter" },
  { value: "chose", label: "Chose option" },
  { value: "flag", label: "Flag comparison" },
  { value: "endingReached", label: "Ending reached" },
];

export function ConditionBuilder({
  value,
  onChange,
  chapters,
  choices,
  flagKeys,
}: {
  value: ConditionNode | null;
  onChange: (next: ConditionNode | null) => void;
  chapters: ChapterOpt[];
  choices: ChoiceOpt[];
  flagKeys: string[];
}) {
  return (
    <div className="rounded-lg border border-parchment/10 bg-black/20 p-3">
      <Node
        node={value}
        onChange={onChange}
        chapters={chapters}
        choices={choices}
        flagKeys={flagKeys}
      />
    </div>
  );
}

function Node({
  node,
  onChange,
  chapters,
  choices,
  flagKeys,
}: {
  node: ConditionNode | null;
  onChange: (next: ConditionNode | null) => void;
  chapters: ChapterOpt[];
  choices: ChoiceOpt[];
  flagKeys: string[];
}) {
  const currentOp: ConditionNode["op"] | "none" = node?.op ?? "none";
  const cn =
    "rounded border border-parchment/20 bg-transparent px-2 py-1 text-xs text-parchment";

  function setOp(op: ConditionNode["op"] | "none") {
    if (op === "none") return onChange(null);
    switch (op) {
      case "and":
      case "or":
        return onChange({ op, children: [] });
      case "not":
        return onChange({ op, child: { op: "flag", key: "", cmp: "==", value: true } });
      case "visited":
        return onChange({ op, chapterId: chapters[0]?.id ?? "" });
      case "chose":
        return onChange({ op, choiceId: choices[0]?.id ?? "" });
      case "flag":
        return onChange({ op, key: flagKeys[0] ?? "", cmp: "==", value: true });
      case "endingReached":
        return onChange({ op, chapterId: chapters[0]?.id ?? "" });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          className={cn}
          value={currentOp}
          onChange={(e) => setOp(e.target.value as ConditionNode["op"] | "none")}
        >
          {OPS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {node?.op === "and" || node?.op === "or" ? (
        <div className="space-y-2 border-l border-parchment/10 pl-3">
          {node.children.map((child, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <Node
                  node={child}
                  onChange={(next) => {
                    const nextChildren = node.children.slice();
                    if (next === null) nextChildren.splice(i, 1);
                    else nextChildren[i] = next;
                    onChange({ ...node, children: nextChildren });
                  }}
                  chapters={chapters}
                  choices={choices}
                  flagKeys={flagKeys}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className={`${cn} hover:border-accent hover:text-accent`}
            onClick={() =>
              onChange({
                ...node,
                children: [
                  ...node.children,
                  { op: "flag", key: flagKeys[0] ?? "", cmp: "==", value: true } as ConditionNode,
                ],
              })
            }
          >
            + child
          </button>
        </div>
      ) : null}

      {node?.op === "not" ? (
        <div className="border-l border-parchment/10 pl-3">
          <Node
            node={node.child}
            onChange={(next) =>
              next
                ? onChange({ op: "not", child: next })
                : onChange(null)
            }
            chapters={chapters}
            choices={choices}
            flagKeys={flagKeys}
          />
        </div>
      ) : null}

      {node?.op === "visited" || node?.op === "endingReached" ? (
        <select
          className={cn}
          value={node.chapterId}
          onChange={(e) => onChange({ ...node, chapterId: e.target.value })}
        >
          <option value="">—</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      ) : null}

      {node?.op === "chose" ? (
        <select
          className={cn}
          value={node.choiceId}
          onChange={(e) => onChange({ ...node, choiceId: e.target.value })}
        >
          <option value="">—</option>
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.chapterTitle ? `${c.chapterTitle} — ` : ""}
              {c.label}
            </option>
          ))}
        </select>
      ) : null}

      {node?.op === "flag" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={cn + " min-w-[8rem]"}
            placeholder="flag key"
            list="flag-keys"
            value={node.key}
            onChange={(e) => onChange({ ...node, key: e.target.value })}
          />
          <datalist id="flag-keys">
            {flagKeys.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <select
            className={cn}
            value={node.cmp}
            onChange={(e) => onChange({ ...node, cmp: e.target.value as Cmp })}
          >
            {CMPS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className={cn + " min-w-[8rem]"}
            placeholder="value"
            value={String(node.value)}
            onChange={(e) => onChange({ ...node, value: coerce(e.target.value) })}
          />
        </div>
      ) : null}
    </div>
  );
}

function coerce(s: string): string | number | boolean {
  if (s === "true") return true;
  if (s === "false") return false;
  const n = Number(s);
  if (s.trim() !== "" && Number.isFinite(n)) return n;
  return s;
}
