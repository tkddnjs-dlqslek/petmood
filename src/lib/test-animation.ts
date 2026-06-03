import { photoDB } from "./storage/photo-db";
import { ensureCompactCutout } from "./cutout-maintenance";
import { pickAnimationType } from "./triggers/policy";
import type {
  PetMoodSettings,
  DisplayType,
  StoredPhoto,
  StoredPhotoMeta,
} from "../types";

export type AnimChoice = DisplayType | "random";

export const ANIM_TESTS: { type: AnimChoice; label: string }[] = [
  { type: "random",      label: "Surprise Me!" },
  { type: "stampede",    label: "Stampede" },
  { type: "rain",        label: "Rain" },
  { type: "parade",      label: "Parade" },
  { type: "peekaboo",    label: "Peekaboo" },
  { type: "bounce",      label: "Bounce" },
  { type: "popcorn",     label: "Popcorn" },
  { type: "carousel",    label: "Carousel" },
  { type: "tornado",     label: "Tornado" },
  { type: "float",       label: "Float" },
  { type: "photoBooth",  label: "Photo Booth" },
  { type: "teleport",    label: "Teleport" },
  { type: "dominoFall",  label: "Domino" },
  { type: "trampoline",  label: "Trampoline" },
  { type: "bowling",     label: "Bowling" },
  { type: "fireworks",   label: "Fireworks" },
  { type: "kiss",        label: "Kiss" },
  { type: "rainbowArc",  label: "Rainbow" },
  { type: "danceParty",  label: "Dance" },
];

export type SendFailureReason =
  | "no-photos"
  | "no-cutouts"
  | "no-tab"
  | "disabled"
  | "extension-not-loaded"
  | "send-error";

export type SendResult =
  | { ok: true }
  | { ok: false; reason: SendFailureReason; error?: unknown };

export const SEND_FAILURE_MESSAGES: Record<SendFailureReason, string> = {
  "no-photos": "Please register photos first!",
  "no-cutouts": "Couldn't load photo data. Please re-register your photos in Settings.",
  "no-tab": "Please open a webpage!",
  "disabled": "Extension is off. Turn it on from the popup.",
  "extension-not-loaded":
    "PetMood hasn't loaded on this page yet.\nPlease refresh the page and try again.",
  "send-error": "Send failed",
};

interface DispatchArgs {
  settings: PetMoodSettings;
  requested: AnimChoice;
  /** Respect the on/off toggle (skip when the extension is disabled). */
  enforcePolicy: boolean;
  /** Caller-owned meta cache so each entry point keeps its own warmth. */
  photosCache: { current: StoredPhotoMeta[] | null };
}

const SWARM_POOL_MAX = 12;

/**
 * Unified notification dispatcher used by the popup test buttons and the
 * background alarm scheduler. Samples photos, self-heals oversized cutouts,
 * and sends the animation payload to the active tab.
 */
export async function dispatchNotification(args: DispatchArgs): Promise<SendResult> {
  const { settings, requested, enforcePolicy, photosCache } = args;

  try {
    const displayType: DisplayType =
      requested === "random" ? pickAnimationType() : requested;

    let metas = photosCache.current;
    if (!metas) {
      metas = await photoDB.getAllPhotosMeta();
      photosCache.current = metas;
    }
    if (metas.length === 0) return { ok: false, reason: "no-photos" };

    const sample = [...metas]
      .sort(() => Math.random() - 0.5)
      .slice(0, SWARM_POOL_MAX);
    const fetched = await Promise.all(sample.map((m) => photoDB.getPhoto(m.id)));
    const usable = fetched.filter(
      (p): p is StoredPhoto => !!p?.cutoutDataUrl
    );
    if (usable.length === 0) return { ok: false, reason: "no-cutouts" };

    const photo = usable[Math.floor(Math.random() * usable.length)];
    const allImageUrls = await Promise.all(usable.map(ensureCompactCutout));
    const imageDataUrl = await ensureCompactCutout(photo);

    if (enforcePolicy && !settings.isEnabled) {
      return { ok: false, reason: "disabled" };
    }

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return { ok: false, reason: "no-tab" };

    await chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_NOTIFICATION",
      payload: {
        imageDataUrl,
        displayType,
        swarmImageUrls: allImageUrls,
      },
    });

    return { ok: true };
  } catch (err) {
    console.error("dispatchNotification error:", err);
    const msg = String(err);
    const reason: SendFailureReason =
      msg.includes("Receiving end does not exist") ||
      msg.includes("Could not establish connection")
        ? "extension-not-loaded"
        : "send-error";
    return { ok: false, reason, error: err };
  }
}
