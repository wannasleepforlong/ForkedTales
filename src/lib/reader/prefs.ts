// Reader preferences, persisted per-viewer in localStorage. Kept small
// on purpose — server-side sync belongs in a later phase.

export interface ReaderPrefs {
  typewriter: boolean;
  charsPerSecond: number; // 15–120 recommended
  autoAdvance: boolean;
  autoAdvanceMs: number;
  textScale: number; // 0.85 – 1.5
}

export const DEFAULT_PREFS: ReaderPrefs = {
  typewriter: true,
  charsPerSecond: 50,
  autoAdvance: false,
  autoAdvanceMs: 1600,
  textScale: 1,
};

const KEY = "forkedtales.prefs";

export function loadPrefs(): ReaderPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFS,
      ...(typeof parsed === "object" && parsed ? parsed : {}),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: ReaderPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private mode */
  }
}
