import { useState, useEffect, useRef } from "react";
import { settingsStore } from "../../lib/storage/settings-store";
import { photoDB } from "../../lib/storage/photo-db";
import {
  ANIM_TESTS,
  SEND_FAILURE_MESSAGES,
  dispatchNotification,
  type AnimChoice,
} from "../../lib/test-animation";
import type { PetMoodSettings, StoredPhotoMeta } from "../../types";

export default function App() {
  const [settings, setSettings] = useState<PetMoodSettings | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [sending, setSending] = useState<string | null>(null);
  // Cache lightweight metas only — never pin full cutouts in popup memory
  const photosRef = useRef<StoredPhotoMeta[] | null>(null);

  useEffect(() => {
    settingsStore.get().then(setSettings);
    photoDB.getPhotoCount().then(setPhotoCount);
    const unsubscribe = settingsStore.onChange(setSettings);
    return unsubscribe;
  }, []);

  if (!settings) {
    return (
      <div className="w-[320px] p-4 text-center text-gray-400">Loading...</div>
    );
  }

  if (!settings.onboardingCompleted) {
    return (
      <div className="w-[320px] p-6 text-center">
        <h2 className="text-lg font-bold mb-2">PetMood</h2>
        <p className="text-sm text-gray-500 mb-4">
          Register your pet's photos to get started!
        </p>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition"
        >
          Get Started
        </button>
      </div>
    );
  }

  const handleTestAnimation = async (requested: AnimChoice) => {
    if (sending) return;
    setSending(requested);
    // The popup gates only the "Surprise Me!" path on the on/off toggle;
    // specific animation buttons are always allowed because they're explicit
    // test-mode taps.
    const result = await dispatchNotification({
      settings,
      requested,
      enforcePolicy: requested === "random",
      photosCache: photosRef,
    });
    if (!result.ok) {
      const base = SEND_FAILURE_MESSAGES[result.reason];
      alert(result.error ? `${base}: ${String(result.error)}` : base);
    }
    setSending(null);
  };

  const handleToggle = async () => {
    await settingsStore.set({ isEnabled: !settings.isEnabled });
  };

  return (
    <div className="w-[320px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold">PetMood</h2>
          <p className="text-xs text-gray-400">
            {settings.petName} cheers for {settings.userName}!
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative w-12 h-6 rounded-full transition-colors overflow-hidden p-0 ${
            settings.isEnabled ? "bg-orange-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              settings.isEnabled ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Stats */}
      <div className="bg-gray-50 rounded-lg p-2 text-center mb-3">
        <p className="text-xl font-bold text-orange-500">{photoCount}</p>
        <p className="text-[10px] text-gray-500">Photos</p>
      </div>

      {/* Animation Test Buttons */}
      <div className="mb-3">
        <p className="text-xs text-gray-400 mb-2">Test</p>
        <button
          onClick={() => handleTestAnimation("random")}
          disabled={!!sending}
          className={`w-full py-3 px-3 rounded-lg text-sm font-semibold transition border mb-2 ${
            sending === "random"
              ? "bg-orange-500 border-orange-500 text-white"
              : "bg-gradient-to-r from-orange-400 to-pink-400 border-transparent text-white hover:from-orange-500 hover:to-pink-500"
          } disabled:opacity-50`}
        >
          ✨ Surprise Me!
        </button>
        <div className="grid grid-cols-3 gap-1.5">
          {ANIM_TESTS.filter((t) => t.type !== "random").map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleTestAnimation(type)}
              disabled={!!sending}
              className={`py-2 px-1.5 rounded-lg text-xs font-medium transition border ${
                sending === type
                  ? "bg-orange-100 border-orange-300 text-orange-600"
                  : "bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-700"
              } disabled:opacity-50`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Link */}
      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        className="w-full text-center text-sm text-orange-500 hover:text-orange-600 py-2 border border-orange-200 rounded-lg transition"
      >
        Open Settings
      </button>
    </div>
  );
}
