"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postCommentAction, deleteCommentAction } from "./socialActions";

export type CommentRow = {
  id: string;
  body: string;
  createdAt: string;
  authorHandle: string | null;
  authorId: string;
};

export function Comments({
  storyId,
  slug,
  currentUserId,
  isAuthor,
  comments,
}: {
  storyId: string;
  slug: string;
  currentUserId: string | null;
  isAuthor: boolean;
  comments: CommentRow[];
}) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setErr(null);
    if (!text.trim()) return;
    startTransition(async () => {
      const result = await postCommentAction({ storyId, slug, body: text.trim() });
      if (result?.error) setErr(result.error);
      else {
        setText("");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this comment?")) return;
    startTransition(async () => {
      await deleteCommentAction({ commentId: id, slug });
      router.refresh();
    });
  }

  return (
    <div>
      <h3 className="font-serif text-2xl text-parchment/85">Comments</h3>

      {currentUserId ? (
        <div className="mt-3">
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Leave a thought…"
            className="w-full"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={pending || !text.trim()}
              className="btn-primary"
            >
              {pending ? "Posting…" : "Post"}
            </button>
            {err && <span className="text-sm text-red-300">{err}</span>}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-parchment/60">
          <Link
            href={`/login?next=${encodeURIComponent(`/stories/${slug}`)}`}
            className="underline hover:text-accent"
          >
            Sign in
          </Link>{" "}
          to leave a comment.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {comments.length === 0 && (
          <li className="text-sm text-parchment/50">No comments yet.</li>
        )}
        {comments.map((c) => {
          const canDelete = c.authorId === currentUserId || isAuthor;
          return (
            <li key={c.id} className="card p-4">
              <div className="flex items-center justify-between text-xs text-parchment/60">
                <span>
                  @{c.authorHandle ?? "…"} · {new Date(c.createdAt).toLocaleString()}
                </span>
                {canDelete && (
                  <button
                    onClick={() => remove(c.id)}
                    className="text-red-300/80 hover:text-red-300"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-parchment/90">{c.body}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
