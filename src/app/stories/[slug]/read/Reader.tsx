"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBgmController, type BgmController } from "@/lib/reader/bgm";
import { evaluate, applyEffects, makeCtx } from "@/lib/engine/conditions";
import { loadPrefs, savePrefs, DEFAULT_PREFS, type ReaderPrefs } from "@/lib/reader/prefs";
import type { ConditionNode, Effect } from "@/lib/types";
import { persistStepAction, recordEndingAction } from "./progressActions";
import { Typewriter } from "./Typewriter";
import { ReaderSettings } from "./ReaderSettings";

type Block = { type: string; data: Record<string, unknown> };
type Chapter = {
  id: string;
  title: string;
  isEnding: boolean;
  endingLabel: string | null;
  unlockCondition: ConditionNode | null;
  blocks: Block[];
};
type ChoiceEdge = {
  id: string;
  label: string;
  targetChapterId: string | null;
  showCondition: ConditionNode | null;
  effects: Effect[];
};

type Story = { id: string; slug: string; title: string; startChapterId: string };

export function Reader({
  story,
  slot,
  chapters,
  choicesByChapter,
  initialProgress,
  initialDiscoveredEndings,
}: {
  story: Story;
  slot: number;
  chapters: Chapter[];
  choicesByChapter: Record<string, ChoiceEdge[]>;
  initialProgress: {
    currentChapterId: string | null;
    visitedChapterIds: string[];
    pickedChoiceIds: string[];
    flags: Record<string, unknown>;
  } | null;
  initialDiscoveredEndings: string[];
}) {
  const chapterMap = useMemo(() => {
    const m: Record<string, Chapter> = {};
    for (const c of chapters) m[c.id] = c;
    return m;
  }, [chapters]);

  const startId = initialProgress?.currentChapterId ?? story.startChapterId;
  const [started, setStarted] = useState(false);
  const [chapterId, setChapterId] = useState<string>(
    chapterMap[startId] ? startId : story.startChapterId,
  );
  const [cursor, setCursor] = useState(0);
  const [visibleLines, setVisibleLines] = useState<Block[]>([]);
  const [bg, setBg] = useState<string | null>(null);
  const [sprites, setSprites] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, unknown>>(
    initialProgress?.flags ?? {},
  );
  const [visited, setVisited] = useState<string[]>(
    initialProgress?.visitedChapterIds ?? [],
  );
  const [picked, setPicked] = useState<string[]>(
    initialProgress?.pickedChoiceIds ?? [],
  );
  const [discoveredEndings, setDiscoveredEndings] = useState<string[]>(
    initialDiscoveredEndings,
  );
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  const [lastLineDone, setLastLineDone] = useState(true);
  const bgmRef = useRef<BgmController | null>(null);
  const autoAdvanceRef = useRef<number | null>(null);

  // Load persisted prefs client-side once.
  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);
  function updatePrefs(next: ReaderPrefs) {
    setPrefs(next);
    savePrefs(next);
  }

  const chapter = chapterMap[chapterId];

  useEffect(() => {
    if (!bgmRef.current) bgmRef.current = createBgmController();
    return () => {
      bgmRef.current?.destroy();
      bgmRef.current = null;
    };
  }, []);

  const persistEnter = useCallback(
    async (targetChapterId: string, choiceId: string | null, nextFlags: Record<string, unknown>) => {
      const nextVisited = Array.from(new Set([...visited, targetChapterId]));
      const nextPicked = choiceId ? Array.from(new Set([...picked, choiceId])) : picked;
      setVisited(nextVisited);
      setPicked(nextPicked);

      try {
        await persistStepAction({
          storyId: story.id,
          slot,
          chapterId: targetChapterId,
          choiceId,
          flags: nextFlags,
          visitedChapterIds: nextVisited,
          pickedChoiceIds: nextPicked,
        });
      } catch {
        /* fail-soft */
      }

      const target = chapterMap[targetChapterId];
      if (target?.isEnding) {
        setDiscoveredEndings((prev) =>
          prev.includes(targetChapterId) ? prev : [...prev, targetChapterId],
        );
        try {
          await recordEndingAction({ storyId: story.id, chapterId: targetChapterId });
        } catch {
          /* ignore */
        }
      }
    },
    [chapterMap, picked, slot, story.id, visited],
  );

  useEffect(() => {
    if (!started) return;
    void persistEnter(chapterId, null, flags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const step = useCallback(async () => {
    if (!chapter || busy) return;
    setBusy(true);

    let i = cursor;
    let stopped = false;
    let nextFlags = flags;

    while (i < chapter.blocks.length && !stopped) {
      const b = chapter.blocks[i];
      if (b.type === "narration" || b.type === "dialogue") {
        setVisibleLines((prev) => [...prev, b]);
        setLastLineDone(false);
        i++;
        stopped = true;
        break;
      }
      switch (b.type) {
        case "bgm.play":
          bgmRef.current?.play(String(b.data.track ?? ""), {
            loop: b.data.loop !== false,
            volume: numberOr(b.data.volume, 0.7),
            fadeMs: numberOr(b.data.fadeMs, 800),
          });
          break;
        case "bgm.change":
          bgmRef.current?.change(String(b.data.track ?? ""), {
            volume: numberOr(b.data.volume, 0.7),
            fadeMs: numberOr(b.data.fadeMs, 800),
          });
          break;
        case "bgm.stop":
          bgmRef.current?.stop(numberOr(b.data.fadeMs, 800));
          break;
        case "background":
          setBg(String(b.data.image ?? "") || null);
          break;
        case "sprite": {
          const side = String(b.data.side ?? "center");
          const image = String(b.data.image ?? "");
          const action = String(b.data.action ?? "show");
          setSprites((prev) => {
            const next = { ...prev };
            if (action === "hide" || !image) delete next[side];
            else next[side] = image;
            return next;
          });
          break;
        }
        case "sfx": {
          const url = String(b.data.url ?? "");
          if (url) {
            const a = new Audio(url);
            a.volume = 0.9;
            a.play().catch(() => {});
          }
          break;
        }
        case "wait":
          await new Promise((r) => setTimeout(r, numberOr(b.data.ms, 400)));
          break;
        case "flagSet": {
          const key = String(b.data.key ?? "");
          if (key) {
            if ("inc" in b.data) {
              const inc = Number(b.data.inc);
              const cur = Number(nextFlags[key] ?? 0);
              nextFlags = { ...nextFlags, [key]: (Number.isFinite(cur) ? cur : 0) + (Number.isFinite(inc) ? inc : 0) };
            } else {
              nextFlags = { ...nextFlags, [key]: b.data.value };
            }
            setFlags(nextFlags);
          }
          break;
        }
      }
      i++;
    }

    setCursor(i);
    setBusy(false);
  }, [chapter, cursor, busy, flags]);

  useEffect(() => {
    if (!started || cursor !== 0 || !chapter) return;
    void step();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, chapterId]);

  // Auto-advance ticks a call to step() once the current line finishes,
  // waiting the user-configured delay.
  useEffect(() => {
    if (!started) return;
    if (!prefs.autoAdvance) return;
    if (!lastLineDone) return;
    if (busy) return;
    if (!chapter || cursor >= chapter.blocks.length) return;
    autoAdvanceRef.current = window.setTimeout(() => {
      void step();
    }, prefs.autoAdvanceMs);
    return () => {
      if (autoAdvanceRef.current !== null) {
        window.clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
  }, [started, prefs.autoAdvance, prefs.autoAdvanceMs, lastLineDone, busy, chapter, cursor, step]);

  const atChapterEnd = chapter && cursor >= chapter.blocks.length;

  const availableChoices = useMemo(() => {
    if (!chapter || !atChapterEnd) return [];
    const edges = choicesByChapter[chapter.id] ?? [];
    const ctx = makeCtx({
      visitedChapterIds: new Set(visited),
      pickedChoiceIds: new Set(picked),
      discoveredEndings: new Set(discoveredEndings),
      flags,
    });
    return edges.filter((edge) => {
      if (!evaluate(edge.showCondition, ctx)) return false;
      if (edge.targetChapterId) {
        const target = chapterMap[edge.targetChapterId];
        if (!target) return false;
        if (!evaluate(target.unlockCondition, ctx)) return false;
      }
      return true;
    });
  }, [atChapterEnd, chapter, choicesByChapter, chapterMap, visited, picked, discoveredEndings, flags]);

  function pickChoice(edge: ChoiceEdge) {
    const nextFlags = applyEffects(edge.effects, flags);
    setFlags(nextFlags);
    for (const eff of edge.effects) {
      if (eff.op === "unlockEnding") {
        setDiscoveredEndings((prev) =>
          prev.includes(eff.chapterId) ? prev : [...prev, eff.chapterId],
        );
        void recordEndingAction({ storyId: story.id, chapterId: eff.chapterId });
      }
    }
    if (!edge.targetChapterId) return;
    setChapterId(edge.targetChapterId);
    setCursor(0);
    setVisibleLines([]);
    setSprites({});
    void persistEnter(edge.targetChapterId, edge.id, nextFlags);
  }

  const ambient = useMemo(
    () =>
      bg
        ? { backgroundImage: `url(${JSON.stringify(bg)})`, backgroundSize: "cover", backgroundPosition: "center" }
        : {},
    [bg],
  );

  if (!started) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center animate-fade-in">
        <p className="label">
          Slot {slot + 1}
          {initialProgress ? " · Continuing" : " · Fresh start"}
        </p>
        <h1 className="mt-3 font-serif text-5xl text-accent">{story.title}</h1>
        {chapter && (
          <p className="mt-3 italic text-parchment/70">Currently at &ldquo;{chapter.title}&rdquo;</p>
        )}
        <button onClick={() => setStarted(true)} className="btn-primary mt-10">
          {initialProgress ? "Resume" : "Begin"}
        </button>
      </main>
    );
  }

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] overflow-hidden transition-[background] duration-700"
      style={ambient}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/10 to-ink/90" />

      <div className="pointer-events-none absolute inset-x-0 bottom-40 flex items-end justify-around">
        {(["left", "center", "right"] as const).map((side) => {
          const image = sprites[side];
          if (!image) return <div key={side} className="w-1/4" />;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={side}
              src={image}
              alt=""
              className="max-h-[60vh] object-contain drop-shadow-2xl animate-fade-in"
            />
          );
        })}
      </div>

      <div className="relative mx-auto flex max-w-3xl flex-col gap-6 px-6 pb-20 pt-16">
        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-parchment/60">
          <span>
            {story.title} · {chapter?.title}
            {chapter?.isEnding && chapter.endingLabel && ` · Ending: ${chapter.endingLabel}`}
          </span>
          <div className="flex items-center gap-3">
            <Link href={`/stories/${story.slug}?slot=${slot}`} className="hover:text-accent">
              Saves & tree ↗
            </Link>
            <ReaderSettings prefs={prefs} onChange={updatePrefs} />
          </div>
        </div>

        <div
          className="glass min-h-[10rem] rounded-2xl p-6 shadow-glow"
          style={{ fontSize: `${prefs.textScale}rem` }}
          onClick={() => {
            // Click the text pane to skip the typewriter, then to advance.
            if (!lastLineDone) setLastLineDone(true);
          }}
        >
          {visibleLines.length === 0 ? (
            <p className="text-parchment/60">…</p>
          ) : (
            <div className="prose-vn space-y-3">
              {visibleLines.map((b, i) => {
                const isLast = i === visibleLines.length - 1;
                return (
                  <div key={i} className="animate-fade-in">
                    <LineView
                      block={b}
                      typewriter={isLast && !lastLineDone && prefs.typewriter}
                      cps={prefs.charsPerSecond}
                      onDone={isLast ? () => setLastLineDone(true) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col items-stretch gap-3">
          {!atChapterEnd ? (
            <button
              onClick={() => void step()}
              disabled={busy}
              className="btn-primary self-end"
            >
              Continue
            </button>
          ) : availableChoices.length > 0 ? (
            <div className="grid gap-2 animate-fade-in">
              <p className="label">What do you do?</p>
              {availableChoices.map((edge) => (
                <button
                  key={edge.id}
                  onClick={() => pickChoice(edge)}
                  className="group relative rounded-xl border border-white/15 bg-ink/70 px-5 py-4 text-left transition-all
                             hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow"
                >
                  <span className="mr-2 text-accent opacity-60 transition group-hover:opacity-100">
                    ➤
                  </span>
                  {edge.label}
                </button>
              ))}
            </div>
          ) : chapter?.isEnding ? (
            <Link
              href={`/stories/${story.slug}?slot=${slot}`}
              className="btn-ghost self-end"
            >
              The end · back to story
            </Link>
          ) : (
            <p className="self-end text-sm text-parchment/60">
              This branch has no continuation.{" "}
              <Link href={`/stories/${story.slug}?slot=${slot}`} className="underline">
                See your saves & tree
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LineView({
  block,
  typewriter,
  cps,
  onDone,
}: {
  block: Block;
  typewriter: boolean;
  cps: number;
  onDone?: () => void;
}) {
  const text = String(block.data.text ?? "");
  const inner = typewriter ? (
    <Typewriter text={text} cps={cps} enabled onDone={onDone} />
  ) : (
    <>{text}</>
  );

  useDoneWhenStatic(typewriter, onDone);

  if (block.type === "dialogue") {
    const speaker = String(block.data.speaker ?? "");
    return (
      <p>
        {speaker && <span className="mr-2 font-serif text-accent">{speaker}:</span>}
        <span>{inner}</span>
      </p>
    );
  }
  return <p className="italic text-parchment/85">{inner}</p>;
}

// If the typewriter is off, fire onDone once so auto-advance still works.
function useDoneWhenStatic(typewriter: boolean, onDone?: () => void) {
  useEffect(() => {
    if (!typewriter) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typewriter]);
}

function numberOr(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
