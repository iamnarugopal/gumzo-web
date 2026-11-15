// Lightweight client-side abuse guards. These stop casual bots and accidental
// double submits. They are NOT a security boundary: the real limits are
// enforced by the Edge Functions and database triggers.

const PREFIX = "gumzo:last-submit:";

/** Seconds left before the user may submit again (0 = allowed). */
export function cooldownRemaining(name: string, cooldownMs: number): number {
  try {
    const last = Number(localStorage.getItem(PREFIX + name) ?? 0);
    const left = last + cooldownMs - Date.now();
    return left > 0 ? Math.ceil(left / 1000) : 0;
  } catch {
    return 0;
  }
}

export function markSubmitted(name: string): void {
  try {
    localStorage.setItem(PREFIX + name, String(Date.now()));
  } catch {
    // Storage may be unavailable (private mode); ignore.
  }
}

/** Forms filled in under this many ms are almost certainly automated. */
export const MIN_FILL_TIME_MS = 2500;
