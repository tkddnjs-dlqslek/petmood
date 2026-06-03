import { photoDB } from "./storage/photo-db";
import { shrinkDataUrl } from "./image-utils";
import type { StoredPhoto } from "../types";

// Base64 cutouts longer than this are legacy full-res PNGs (10-26MB each).
// New cutouts from the processor are already ≤1024px WebP, well under this.
const OVERSIZED_CUTOUT = 700_000;

/**
 * Returns a compact (≤1024px WebP) cutout URL for the photo.
 *
 * If the stored cutout is an oversized legacy PNG, it's shrunk AND persisted
 * back to IndexedDB, so every later read is already small. Idempotent: once a
 * cutout is compact this is a single length check and returns immediately.
 *
 * A 1024px WebP cutout is ~100-300 KB — small enough to both render in the
 * editor and pass through chrome.tabs.sendMessage's 64MB limit, so callers
 * need no separate shrink-for-messaging step.
 */
export async function ensureCompactCutout(photo: StoredPhoto): Promise<string> {
  const url = photo.cutoutDataUrl;
  if (!url || url.length <= OVERSIZED_CUTOUT) return url;

  const small = await shrinkDataUrl(url, 1024);
  if (small.length < url.length) {
    photoDB.setCutout(photo.id, small).catch(() => {}); // persist for next read
    return small;
  }
  return url;
}

/**
 * Heal legacy oversized cutouts. Reads only the photo-cutouts store (cheap
 * length check on each entry) — skips the photos store entirely. Once every
 * cutout is compact this is a single bulk read with no further work, so it's
 * safe to run on every mount without a fragile "done" flag.
 */
export async function compactLegacyCutouts(): Promise<void> {
  const entries = await photoDB.getAllCutoutEntries();
  for (const entry of entries) {
    if (entry.cutoutDataUrl.length <= OVERSIZED_CUTOUT) continue;
    const small = await shrinkDataUrl(entry.cutoutDataUrl, 1024);
    if (small.length < entry.cutoutDataUrl.length) {
      await photoDB.setCutout(entry.id, small);
    }
  }
}
