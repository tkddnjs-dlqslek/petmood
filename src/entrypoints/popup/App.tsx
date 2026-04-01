import { useState, useEffect } from "react";
import { settingsStore } from "../../lib/storage/settings-store";
import { photoDB } from "../../lib/storage/photo-db";
import {
  selectMessage,
  getTimeContext,
} from "../../lib/templates/selector";
import type { PetMoodSettings, DisplayType } from "../../types";

const ANIM_TESTS: { type: DisplayType; label: string }[] = [
  { type: "bubble", label: "Speech Bubble" },
  { type: "running", label: "Running (Catch me!)" },
];

export default function App() {
  const [settings, setSettings] = useState<PetMoodSettings | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [sending, setSending] = useState<string | null>(null);

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

  const handleTestAnimation = async (displayType: DisplayType) => {
    if (sending) return;
    setSending(displayType);

    try {
      const photo = await photoDB.getRandomPhoto();
      if (!photo) {
        alert("Please register photos first!");
        return;
      }

      const hour = new Date().getHours();
      const { text } = selectMessage({
        activity: photo.activity,
        triggerType: "timer",
        currentHour: hour,
        userName: settings.userName,
        petName: settings.petName,
        recentMessageIds: [],
      });

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        alert("Please open a webpage!");
        return;
      }

      // Import messages for running animation dialogues
      const allMessages = await import("../../lib/templates/message-bank").then(m => m.MESSAGE_BANK);

      await chrome.tabs.sendMessage(tab.id, {
        type: "SHOW_NOTIFICATION",
        payload: {
          imageDataUrl: photo.cutoutDataUrl,
          message: text,
          displayType,
          position: settings.display.position,
          durationSeconds: settings.display.displayDurationSeconds,
          // Extra lines for running animation
          runLines: allMessages.running ?? [],
          bounceLines: ["Boing!", "Wheee~!", "Wall? No problem!"],
          caughtLines: allMessages.caught ?? ["Oh no... you got me..."],
          escapedLines: allMessages.escaped ?? ["Hehehe~ can't catch me!"],
        },
      });
    } catch (err) {
      console.error("Test error:", err);
      alert("Failed to send. Please try on a webpage.");
    } finally {
      setSending(null);
    }
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
          className={`relative w-12 h-6 rounded-full transition-colors ${
            settings.isEnabled ? "bg-orange-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              settings.isEnabled ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-xl font-bold text-orange-500">{photoCount}</p>
          <p className="text-[10px] text-gray-500">Photos</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-xl font-bold text-orange-500">
            {settings.totalNotificationsShown}
          </p>
          <p className="text-[10px] text-gray-500">Alerts</p>
        </div>
      </div>

      {/* Animation Test Buttons */}
      <div className="mb-3">
        <p className="text-xs text-gray-400 mb-2">Test</p>
        <div className="grid grid-cols-2 gap-2">
          {ANIM_TESTS.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleTestAnimation(type)}
              disabled={!!sending}
              className={`py-2.5 px-3 rounded-lg text-sm font-medium transition border ${
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
