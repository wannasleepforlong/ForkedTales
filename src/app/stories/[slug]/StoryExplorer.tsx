"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { forkSlotAction } from "./read/progressActions";

type ChapterNode = {
  id: string;
  title: string;
  isEnding: boolean;
  endingLabel: string | null;
};
type Edge = {
  id: string;
  from: string;
  to: string | null;
  label: string;
};
type PathStep = { seq: number; chapterId: string; choiceId: string | null };

/**
 * Story explorer: three tabs.
 *  - Tree: SVG layout of the chapter graph, colored by discovery state.
 *    Unvisited-but-referenced-by-visited nodes render as silhouettes
 *    ("???") for spoiler-safety; totally undiscovered branches stay hidden.
 *  - Path: the current slot's linear reader_path (a traditional ToC of
 *    the trail so far). Click a step to fork a new slot from there.
 *  - Endings: gallery of endings, discovered ones lit up.
 */
export function StoryExplorer({
  storyId,
  storySlug,
  startChapterId,
  chapters,
  edges,
  activeSlot,
  path,
  visitedChapterIds,
  discoveredEndings,
  endingChapters,
}: {
  storyId: string;
  storySlug: string;
  startChapterId: string;
  chapters: ChapterNode[];
  edges: Edge[];
  activeSlot: number;
  path: PathStep[];
  visitedChapterIds: string[];
  discoveredEndings: string[];
  endingChapters: ChapterNode[];
}) {
  const [tab, setTab] = useState<"tree" | "path" | "endings">("tree");
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-parchment/10">
        {(["tree", "path", "endings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm capitalize ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-parchment/60 hover:text-parchment"
            }`}
          >
            {t === "tree" ? "Branch tree" : t === "path" ? "Table of contents" : "Endings"}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "tree" && (
          <TreeView
            startChapterId={startChapterId}
            chapters={chapters}
            edges={edges}
            visited={visitedChapterIds}
            discoveredEndings={discoveredEndings}
            currentChapterId={path[path.length - 1]?.chapterId ?? null}
          />
        )}
        {tab === "path" && (
          <PathView
            storyId={storyId}
            storySlug={storySlug}
            activeSlot={activeSlot}
            path={path}
            chapters={chapters}
            edges={edges}
          />
        )}
        {tab === "endings" && (
          <EndingsGallery
            storySlug={storySlug}
            endingChapters={endingChapters}
            discovered={discoveredEndings}
          />
        )}
      </div>
    </div>
  );
}

// ---------------- Tree ---------------------------------------------------

function TreeView({
  startChapterId,
  chapters,
  edges,
  visited,
  discoveredEndings,
  currentChapterId,
}: {
  startChapterId: string;
  chapters: ChapterNode[];
  edges: Edge[];
  visited: string[];
  discoveredEndings: string[];
  currentChapterId: string | null;
}) {
  const layout = useMemo(
    () => layoutGraph(startChapterId, chapters, edges, visited),
    [startChapterId, chapters, edges, visited],
  );

  if (layout.nodes.length === 0) {
    return <p className="text-sm text-parchment/60">Nothing to show yet.</p>;
  }

  const visitedSet = new Set(visited);
  const endingSet = new Set(discoveredEndings);

  return (
    <div className="overflow-auto rounded-lg border border-parchment/10 bg-black/20 p-2">
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="min-w-full"
      >
        {layout.edges.map((e) => {
          const from = layout.nodePos[e.from];
          const to = e.to ? layout.nodePos[e.to] : null;
          if (!from || !to) return null;
          const visited = visitedSet.has(e.from) && visitedSet.has(e.to as string);
          return (
            <g key={e.id}>
              <path
                d={curve(from, to)}
                fill="none"
                stroke={visited ? "#c9a227" : "#4a4356"}
                strokeWidth={visited ? 2 : 1.2}
                strokeDasharray={visited ? "" : "4 4"}
              />
            </g>
          );
        })}
        {layout.nodes.map((n) => {
          const pos = layout.nodePos[n.id];
          const isCurrent = n.id === currentChapterId;
          const isVisited = visitedSet.has(n.id);
          const chap = chapters.find((c) => c.id === n.id);
          const isEnding = chap?.isEnding;
          const endingDiscovered = isEnding && endingSet.has(n.id);
          const hidden = !isVisited && !layout.silhouettes.has(n.id);
          if (hidden) return null;
          const label = isVisited
            ? chap?.title ?? "?"
            : isEnding
            ? "??? (ending)"
            : "???";
          const fill = isCurrent
            ? "#c9a227"
            : endingDiscovered
            ? "#e9c46a"
            : isVisited
            ? "rgba(201,162,39,0.15)"
            : "rgba(255,255,255,0.04)";
          const stroke = isCurrent
            ? "#fff"
            : isVisited
            ? "#c9a227"
            : "#4a4356";
          return (
            <g key={n.id} transform={`translate(${pos.x - 70}, ${pos.y - 22})`}>
              <rect
                width={140}
                height={44}
                rx={10}
                fill={fill}
                stroke={stroke}
                strokeWidth={isCurrent ? 2 : 1}
              />
              <text
                x={70}
                y={26}
                textAnchor="middle"
                fontSize={12}
                fill={isCurrent ? "#0e0b16" : "#f6f1e7"}
                fontFamily="system-ui, sans-serif"
              >
                {truncate(label, 18)}
              </text>
              {isEnding && endingDiscovered && (
                <text x={130} y={13} fontSize={12} fill="#e9c46a">
                  ★
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-2 px-2 text-xs text-parchment/50">
        Bright = current · gold border = visited · gold star = discovered
        ending · dashed = unexplored branch (silhouette when reachable in one
        step from a visited chapter).
      </p>
    </div>
  );
}

// ---------------- Path (ToC of current slot) -----------------------------

function PathView({
  storyId,
  storySlug,
  activeSlot,
  path,
  chapters,
  edges,
}: {
  storyId: string;
  storySlug: string;
  activeSlot: number;
  path: PathStep[];
  chapters: ChapterNode[];
  edges: Edge[];
}) {
  const chapterTitle = (id: string) => chapters.find((c) => c.id === id)?.title ?? "?";
  const choiceLabel = (id: string | null) =>
    id ? edges.find((e) => e.id === id)?.label ?? "?" : null;

  const [pendingSeq, setPendingSeq] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function forkHere(atSeq: number) {
    if (!confirm(`Fork a new slot from step ${atSeq + 1}?`)) return;
    setPendingSeq(atSeq);
    startTransition(async () => {
      const result = await forkSlotAction({
        storyId,
        sourceSlot: activeSlot,
        atSeq,
      });
      setPendingSeq(null);
      if (result?.ok && typeof result.slot === "number") {
        router.push(`/stories/${storySlug}?slot=${result.slot}`);
        router.refresh();
      }
    });
  }

  if (path.length === 0) {
    return (
      <p className="text-sm text-parchment/60">
        This slot has no history yet. Start reading to fill it in.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {path.map((step, i) => (
        <li
          key={i}
          className="flex items-center justify-between rounded-lg border border-parchment/10 bg-black/20 px-4 py-2 text-sm"
        >
          <div>
            <span className="text-parchment/50">{String(i + 1).padStart(2, "0")}</span>
            <span className="ml-3 text-parchment">{chapterTitle(step.chapterId)}</span>
            {step.choiceId && (
              <span className="ml-3 text-xs italic text-parchment/60">
                via &ldquo;{choiceLabel(step.choiceId)}&rdquo;
              </span>
            )}
          </div>
          <button
            onClick={() => forkHere(step.seq)}
            disabled={pending && pendingSeq === step.seq}
            className="rounded border border-parchment/20 px-2 py-1 text-xs text-parchment/70 hover:border-accent hover:text-accent"
          >
            Fork here
          </button>
        </li>
      ))}
    </ol>
  );
}

// ---------------- Endings ------------------------------------------------

function EndingsGallery({
  storySlug,
  endingChapters,
  discovered,
}: {
  storySlug: string;
  endingChapters: ChapterNode[];
  discovered: string[];
}) {
  if (endingChapters.length === 0) {
    return <p className="text-sm text-parchment/60">This story has no endings marked yet.</p>;
  }
  const discoveredSet = new Set(discovered);
  return (
    <>
      <p className="mb-3 text-sm text-parchment/70">
        {discoveredSet.size} of {endingChapters.length} discovered
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {endingChapters.map((c) => {
          const isDiscovered = discoveredSet.has(c.id);
          return (
            <li
              key={c.id}
              className={`rounded-lg border p-4 ${
                isDiscovered
                  ? "border-accent/60 bg-accent/5"
                  : "border-parchment/10 bg-black/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-serif text-lg ${
                    isDiscovered ? "text-accent" : "text-parchment/40"
                  }`}
                >
                  {isDiscovered ? c.endingLabel ?? c.title : "???"}
                </span>
                {isDiscovered && <span className="text-accent">★</span>}
              </div>
              {isDiscovered && (
                <p className="mt-1 text-xs text-parchment/60">
                  from chapter &ldquo;{c.title}&rdquo;
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-parchment/50">
        Ending discovery carries across all your slots.{" "}
        <Link href={`/stories/${storySlug}`} className="underline hover:text-accent">
          Try a new branch
        </Link>
        .
      </p>
    </>
  );
}

// ---------------- Layout -------------------------------------------------

function layoutGraph(
  startId: string,
  chapters: ChapterNode[],
  edges: Edge[],
  visited: string[],
) {
  // BFS depth from start; nodes without a reachable path are appended at
  // the end.
  const visitedSet = new Set(visited);
  const outByChapter: Record<string, Edge[]> = {};
  for (const c of chapters) outByChapter[c.id] = [];
  for (const e of edges) if (outByChapter[e.from]) outByChapter[e.from].push(e);

  const depth: Record<string, number> = {};
  const q: string[] = [];
  if (chapters.some((c) => c.id === startId)) {
    depth[startId] = 0;
    q.push(startId);
  }
  while (q.length) {
    const id = q.shift()!;
    for (const e of outByChapter[id] ?? []) {
      if (!e.to) continue;
      if (depth[e.to] === undefined) {
        depth[e.to] = depth[id] + 1;
        q.push(e.to);
      }
    }
  }
  let maxDepth = 0;
  for (const c of chapters) {
    if (depth[c.id] === undefined) depth[c.id] = 0;
    if (depth[c.id] > maxDepth) maxDepth = depth[c.id];
  }

  // Silhouette set: any chapter reachable in one step from a visited chapter
  // via any edge (even if the target itself is not visited).
  const silhouettes = new Set<string>();
  for (const e of edges) {
    if (visitedSet.has(e.from) && e.to && !visitedSet.has(e.to)) {
      silhouettes.add(e.to);
    }
  }

  // Group by depth, then place horizontally.
  const byDepth: Record<number, ChapterNode[]> = {};
  for (const c of chapters) {
    // Skip totally undiscovered + non-silhouette nodes from layout so the
    // canvas doesn't reserve empty columns for them.
    if (!visitedSet.has(c.id) && !silhouettes.has(c.id) && c.id !== startId) continue;
    const d = depth[c.id];
    (byDepth[d] ||= []).push(c);
  }

  const rowGap = 78;
  const colGap = 190;
  const padding = 40;
  const nodePos: Record<string, { x: number; y: number }> = {};
  const nodes: ChapterNode[] = [];
  const depths = Object.keys(byDepth).map(Number).sort((a, b) => a - b);
  let maxCols = 0;
  for (const d of depths) {
    const list = byDepth[d];
    maxCols = Math.max(maxCols, list.length);
    list.forEach((c, i) => {
      nodePos[c.id] = {
        x: padding + i * colGap + colGap / 2,
        y: padding + d * rowGap + rowGap / 2,
      };
      nodes.push(c);
    });
  }
  const width = Math.max(600, padding * 2 + maxCols * colGap);
  const height = Math.max(200, padding * 2 + (depths.length || 1) * rowGap);

  return { nodes, edges, nodePos, width, height, silhouettes };
}

function curve(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const midY = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y + 22} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y - 22}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
