"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { useRouter } from "next/navigation";
import {
  connectChaptersAction,
  createChapterAtAction,
  deleteChoiceAction,
  saveLayoutAction,
} from "./actions";

type ChapterIn = {
  id: string;
  title: string;
  isEnding: boolean;
  draft: boolean;
  layout: { x: number; y: number } | null;
};
type ChoiceIn = { id: string; from: string; to: string | null; label: string };

export function GraphEditor({
  storyId,
  chapters,
  choices,
}: {
  storyId: string;
  chapters: ChapterIn[];
  choices: ChoiceIn[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  const initialNodes: Node[] = useMemo(() => {
    // Auto-layout for chapters without saved positions: rough grid by order.
    return chapters.map((c, i) => ({
      id: c.id,
      position: c.layout ?? { x: (i % 5) * 220 + 60, y: Math.floor(i / 5) * 140 + 60 },
      data: { label: c.title, isEnding: c.isEnding, draft: c.draft },
      type: "chapter",
    }));
  }, [chapters]);

  const initialEdges: Edge[] = useMemo(
    () =>
      choices
        .filter((c) => c.to)
        .map((c) => ({
          id: c.id,
          source: c.from,
          target: c.to as string,
          label: c.label,
          style: { stroke: "#c9a227" },
          labelStyle: { fill: "#f4ecd8", fontSize: 11 },
          labelBgStyle: { fill: "rgba(20,16,36,0.7)" },
        })),
    [choices],
  );

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  useEffect(() => setNodes(initialNodes), [initialNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      if (changes.some((c) => c.type === "position" && !c.dragging)) setDirty(true);
    },
    [],
  );
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      startTransition(async () => {
        const result = await connectChaptersAction({
          storyId,
          fromChapterId: conn.source!,
          targetChapterId: conn.target!,
        });
        if (!result?.error) router.refresh();
      });
      setEdges((eds) => addEdge({ ...conn, style: { stroke: "#c9a227" } }, eds));
    },
    [router, storyId],
  );

  function onEdgeContextMenu(e: React.MouseEvent, edge: Edge) {
    e.preventDefault();
    if (!confirm(`Remove edge "${edge.label ?? ""}"?`)) return;
    startTransition(async () => {
      await deleteChoiceAction({ storyId, choiceId: edge.id });
      router.refresh();
    });
  }

  function saveLayout() {
    const positions = nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }));
    startTransition(async () => {
      await saveLayoutAction({ storyId, positions });
      setDirty(false);
    });
  }

  function addChapter() {
    const title = prompt("New chapter title:", "New chapter");
    if (!title) return;
    startTransition(async () => {
      const result = await createChapterAtAction({
        storyId,
        title,
        x: 120 + Math.random() * 400,
        y: 120 + Math.random() * 300,
      });
      if (!result?.error) router.refresh();
    });
  }

  const nodeTypes = useMemo(
    () => ({
      chapter: ({ data, id }: { data: any; id: string }) => (
        <div
          className={`rounded-lg border px-3 py-2 text-xs shadow-lg ${
            data.isEnding
              ? "border-accent bg-accent/10 text-accent"
              : data.draft
              ? "border-white/15 bg-ink/80 text-parchment/70"
              : "border-parchment/40 bg-ink/90 text-parchment"
          }`}
        >
          <div className="font-serif text-sm">{data.label}</div>
          {data.isEnding && <div className="text-[10px] uppercase tracking-wider">ending</div>}
          <div className="mt-2 flex justify-end">
            <Link
              href={`/author/stories/${storyId}/chapters/${id}`}
              className="text-[10px] text-accent underline"
            >
              edit →
            </Link>
          </div>
        </div>
      ),
    }),
    [storyId],
  );

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <button className="btn-ghost" onClick={addChapter} disabled={pending}>
          + Chapter
        </button>
        <button
          className="btn-primary"
          onClick={saveLayout}
          disabled={pending || !dirty}
        >
          {pending ? "…" : dirty ? "Save layout" : "Layout saved"}
        </button>
        <p className="ml-3 text-xs text-parchment/60">
          Drag between handles to make a choice · right-click an edge to delete
        </p>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeContextMenu={onEdgeContextMenu}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#c9a227" gap={24} size={1} />
        <MiniMap
          nodeColor={(n) => (n.data?.isEnding ? "#c9a227" : "#4a4356")}
          maskColor="rgba(11, 8, 18, 0.8)"
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}
