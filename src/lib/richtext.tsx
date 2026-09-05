// Minimal inline markdown → React renderer for narration and dialogue.
// Supports **bold**, *italic*, and _italic_, plus escaped literals via \*.
// Deliberately tiny — no block-level parsing, no HTML, safe by construction.

import { Fragment, type ReactNode } from "react";

type Tok =
  | { t: "text"; v: string }
  | { t: "bold"; v: Tok[] }
  | { t: "italic"; v: Tok[] };

export function renderRich(source: string): ReactNode {
  return render(tokenize(source));
}

function tokenize(source: string): Tok[] {
  const out: Tok[] = [];
  let buf = "";
  let i = 0;

  const flushText = () => {
    if (buf) {
      out.push({ t: "text", v: buf });
      buf = "";
    }
  };

  while (i < source.length) {
    const ch = source[i];

    if (ch === "\\" && i + 1 < source.length) {
      buf += source[i + 1];
      i += 2;
      continue;
    }

    if (ch === "*" && source[i + 1] === "*") {
      const end = findClose(source, i + 2, "**");
      if (end !== -1) {
        flushText();
        out.push({ t: "bold", v: tokenize(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (ch === "*" || ch === "_") {
      const end = findClose(source, i + 1, ch);
      if (end !== -1) {
        flushText();
        out.push({ t: "italic", v: tokenize(source.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    buf += ch;
    i++;
  }
  flushText();
  return out;
}

function findClose(src: string, from: number, close: string): number {
  const len = close.length;
  for (let i = from; i <= src.length - len; i++) {
    if (src[i] === "\\") {
      i++;
      continue;
    }
    if (src.slice(i, i + len) === close) return i;
  }
  return -1;
}

function render(tokens: Tok[]): ReactNode {
  return tokens.map((t, idx) => {
    if (t.t === "text") return <Fragment key={idx}>{t.v}</Fragment>;
    if (t.t === "bold") return <strong key={idx}>{render(t.v)}</strong>;
    return <em key={idx}>{render(t.v)}</em>;
  });
}
