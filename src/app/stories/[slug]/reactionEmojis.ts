// Plain module — safe to import from client components. The server
// actions file cannot re-export non-async constants (Next.js rewrites
// every export in a "use server" file into an async function proxy,
// which is exactly what caused REACTION_EMOJIS.map to blow up).

export const REACTION_EMOJIS = ["👍", "❤️", "✨", "🔥", "😢", "🤯"] as const;
export type Emoji = (typeof REACTION_EMOJIS)[number];
