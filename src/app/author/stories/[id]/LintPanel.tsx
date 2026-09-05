import Link from "next/link";
import type { LintIssue } from "@/lib/engine/lint";

const SEV_STYLE: Record<LintIssue["severity"], string> = {
  error: "border-red-500/50 bg-red-500/10 text-red-100",
  warn: "border-yellow-500/40 bg-yellow-500/10 text-yellow-100",
  info: "border-white/10 bg-white/[0.03] text-parchment/70",
};

export function LintPanel({
  storyId,
  chapterTitles,
  issues,
}: {
  storyId: string;
  chapterTitles: Record<string, string>;
  issues: LintIssue[];
}) {
  if (issues.length === 0) {
    return (
      <p className="rounded-lg border border-teal/40 bg-teal/10 px-4 py-3 text-sm text-teal">
        ✓ No issues found. Your story is coherent.
      </p>
    );
  }
  return (
    <ul className="grid gap-2">
      {issues.map((i, idx) => (
        <li
          key={idx}
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${SEV_STYLE[i.severity]}`}
        >
          <div>
            <span className="mr-2 font-mono text-xs uppercase opacity-70">{i.severity}</span>
            <span>{i.message}</span>
          </div>
          {i.chapterId && (
            <Link
              href={`/author/stories/${storyId}/chapters/${i.chapterId}`}
              className="text-xs underline opacity-80 hover:opacity-100"
            >
              open {chapterTitles[i.chapterId] ?? "chapter"}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
