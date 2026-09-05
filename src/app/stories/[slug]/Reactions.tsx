"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { REACTION_EMOJIS } from "./reactionEmojis";
import { toggleReactionAction } from "./socialActions";

export function Reactions({
  storyId,
  slug,
  counts,
  mine,
  signedIn,
}: {
  storyId: string;
  slug: string;
  counts: Record<string, number>;
  mine: string[];
  signedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const mineSet = new Set(mine);

  function toggle(emoji: string) {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/stories/${slug}`)}`);
      return;
    }
    startTransition(async () => {
      await toggleReactionAction({ storyId, slug, emoji });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {REACTION_EMOJIS.map((e) => {
        const count = counts[e] ?? 0;
        const mine = mineSet.has(e);
        return (
          <button
            key={e}
            onClick={() => toggle(e)}
            disabled={pending}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition ${
              mine
                ? "border-accent bg-accent/15 text-accent"
                : "border-white/10 bg-white/[0.03] text-parchment/80 hover:border-accent/60"
            }`}
          >
            <span>{e}</span>
            {count > 0 && <span className="text-xs">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
