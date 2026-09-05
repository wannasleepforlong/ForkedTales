// Singleton BGM manager. Persists across chapter navigation as long as
// the Reader component stays mounted, which is the reason the whole
// story is rendered inside one client route.

export interface BgmController {
  play(track: string, opts?: { loop?: boolean; volume?: number; fadeMs?: number }): void;
  change(track: string, opts?: { volume?: number; fadeMs?: number }): void;
  stop(fadeMs?: number): void;
  currentTrack(): string | null;
  destroy(): void;
}

export function createBgmController(): BgmController {
  if (typeof window === "undefined") {
    // Server-side no-op.
    return {
      play() {},
      change() {},
      stop() {},
      currentTrack: () => null,
      destroy() {},
    };
  }

  let audio: HTMLAudioElement | null = null;
  let currentTrack: string | null = null;
  let fadeTimer: number | null = null;

  function cancelFade() {
    if (fadeTimer !== null) {
      window.clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }

  function fadeTo(target: number, ms: number, onDone?: () => void) {
    cancelFade();
    if (!audio) {
      onDone?.();
      return;
    }
    const from = audio.volume;
    const start = performance.now();
    fadeTimer = window.setInterval(() => {
      if (!audio) return;
      const t = Math.min(1, (performance.now() - start) / Math.max(1, ms));
      audio.volume = from + (target - from) * t;
      if (t >= 1) {
        cancelFade();
        onDone?.();
      }
    }, 30);
  }

  function ensureAudio(): HTMLAudioElement {
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      audio.loop = true;
    }
    return audio;
  }

  function play(
    track: string,
    opts?: { loop?: boolean; volume?: number; fadeMs?: number },
  ) {
    if (currentTrack === track && audio && !audio.paused) return;
    const a = ensureAudio();
    a.src = track;
    a.loop = opts?.loop ?? true;
    const targetVol = opts?.volume ?? 0.7;
    a.volume = 0;
    currentTrack = track;
    // Autoplay can reject if the user has not interacted yet — the reader
    // has an explicit "Begin" click, so this generally resolves.
    a.play().catch(() => {});
    fadeTo(targetVol, opts?.fadeMs ?? 800);
  }

  function change(
    track: string,
    opts?: { volume?: number; fadeMs?: number },
  ) {
    const fadeMs = opts?.fadeMs ?? 800;
    if (!audio || currentTrack === null) {
      play(track, { fadeMs, volume: opts?.volume });
      return;
    }
    if (currentTrack === track) return;
    // Cross-fade: fade out, then swap src and fade in.
    fadeTo(0, fadeMs / 2, () => {
      if (!audio) return;
      audio.src = track;
      currentTrack = track;
      audio.play().catch(() => {});
      fadeTo(opts?.volume ?? 0.7, fadeMs / 2);
    });
  }

  function stop(fadeMs = 800) {
    if (!audio || !currentTrack) return;
    fadeTo(0, fadeMs, () => {
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      currentTrack = null;
    });
  }

  function destroy() {
    cancelFade();
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    audio = null;
    currentTrack = null;
  }

  return {
    play,
    change,
    stop,
    currentTrack: () => currentTrack,
    destroy,
  };
}
