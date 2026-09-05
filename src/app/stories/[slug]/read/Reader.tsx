"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBgmController, type BgmController } from "@/lib/reader/bgm";

type Block = { type: string; data: Record<string, unknown> };
type ChapterData = {
  id: string;
  title: string;
  isEnding: boolean;
  endingLabel: string | null;
  blocks: Block[];
};

/**
 * Reader state machine (phase 1, linear).
 *
 *  - `chapterIdx` points at the current chapter.
 *  - `cursor` is the index of the NEXT block to process in that chapter.
 *  - `visibleLines` is the running list of narration/dialogue rendered so
 *    far in the current chapter.
 *  - `step()` walks forward, applying side-effect blocks (bgm, background,
 *    sprite, sfx, wait) inline and stopping once it queues one text line
 *    OR reaches the end of the chapter.
 *
 * BGM lives in a singleton controller that outlives chapter navigation.
 */
export function Reader({
  storyTitle,
  storySlug,
  chapters,
}: {
  storyTitle: string;
  storySlug: string;
  chapters: ChapterData[];
}) {
  const [started, setStarted] = useState(false);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [bg, setBg] = useState<string | null>(null);
  const [sprites, setSprites] = useState<Record<string, string>>({});
  const [visibleLines, setVisibleLines] = useState<Block[]>([]);
  const [busy, setBusy] = useState(false);
  const bgmRef = useRef<BgmController | null>(null);

  const chapter = chapters[chapterIdx];

  useEffect(() => {
    if (!bgmRef.current) bgmRef.current = createBgmController();
    return () => {
      bgmRef.current?.destroy();
      bgmRef.current = null;
    };
  }, []);

  const step = useCallback(async () => {
    if (!chapter || busy) return;
    setBusy(true);

    let i = cursor;
    let stopped = false;

    while (i < chapter.blocks.length && !stopped) {
      const b = chapter.blocks[i];

      if (b.type === "narration" || b.type === "dialogue") {
        setVisibleLines((prev) => [...prev, b]);
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
        default:
          // unknown / choicePrompt / flagSet — no-op for phase 1
          break;
      }
      i++;
    }

    setCursor(i);
    setBusy(false);
  }, [chapter, cursor, busy]);

  // Auto-advance once when the reader starts and when a new chapter opens,
  // so the first line appears without an extra click.
  useEffect(() => {
    if (!started) return;
    if (cursor !== 0) return;
    if (!chapter) return;
    void step();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, chapterIdx]);

  function nextChapter() {
    if (chapterIdx >= chapters.length - 1) return;
    setChapterIdx((i) => i + 1);
    setCursor(0);
    setVisibleLines([]);
    setSprites({});
    // Background and BGM intentionally persist unless the next chapter
    // emits its own directive.
  }

  const atChapterEnd = chapter && cursor >= chapter.blocks.length;
  const isLastChapter = chapterIdx >= chapters.length - 1;

  const ambient = useMemo(
    () =>
      bg
        ? { backgroundImage: `url(${JSON.stringify(bg)})`, backgroundSize: "cover", backgroundPosition: "center" }
        : {},
    [bg],
  );

  if (!started) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl text-accent">{storyTitle}</h1>
        <p className="mt-4 text-parchment/70">
          Audio and pacing work best after a click.
        </p>
        <button
          onClick={() => setStarted(true)}
          className="mt-8 rounded bg-accent px-6 py-2 font-medium text-ink hover:opacity-90"
        >
          Begin
        </button>
      </main>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden" style={ambient}>
      <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/10 to-ink/80" />

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
              className="max-h-[60vh] object-contain drop-shadow-2xl"
            />
          );
        })}
      </div>

      <div className="relative mx-auto flex max-w-3xl flex-col gap-6 px-6 pb-20 pt-16">
        <div className="text-xs uppercase tracking-widest text-parchment/60">
          {storyTitle} · {chapter?.title}
          {chapter?.isEnding && chapter.endingLabel && ` · Ending: ${chapter.endingLabel}`}
        </div>

        <div className="min-h-[10rem] rounded-lg border border-parchment/10 bg-ink/80 p-6 backdrop-blur">
          {visibleLines.length === 0 ? (
            <p className="text-parchment/60">…</p>
          ) : (
            <div className="prose-vn space-y-3">
              {visibleLines.map((b, i) => (
                <LineView key={i} block={b} />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Link
            href={`/stories/${storySlug}`}
            className="text-sm text-parchment/60 hover:text-accent"
          >
            ← Back to story
          </Link>
          {!atChapterEnd ? (
            <button
              onClick={() => void step()}
              disabled={busy}
              className="rounded bg-accent px-5 py-2 font-medium text-ink hover:opacity-90 disabled:opacity-60"
            >
              Continue
            </button>
          ) : chapter?.isEnding || isLastChapter ? (
            <Link
              href={`/stories/${storySlug}`}
              className="rounded border border-accent px-5 py-2 text-accent hover:bg-accent hover:text-ink"
            >
              {chapter?.isEnding ? "The end · back to story" : "The end"}
            </Link>
          ) : (
            <button
              onClick={nextChapter}
              className="rounded bg-accent px-5 py-2 font-medium text-ink hover:opacity-90"
            >
              Next chapter →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LineView({ block }: { block: Block }) {
  if (block.type === "dialogue") {
    const speaker = String(block.data.speaker ?? "");
    const text = String(block.data.text ?? "");
    return (
      <p>
        {speaker && (
          <span className="mr-2 font-serif text-accent">{speaker}:</span>
        )}
        <span>{text}</span>
      </p>
    );
  }
  return <p className="italic text-parchment/90">{String(block.data.text ?? "")}</p>;
}

function numberOr(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
