import { useState, useEffect } from "react";
import { settingsStore } from "../../lib/storage/settings-store";
import type { PetMoodSettings } from "../../types";
import OnboardingPage from "./pages/OnboardingPage";
import PhotoManager from "./pages/PhotoManager";
import TriggerSettings from "./pages/TriggerSettings";
import MessageSettings from "./pages/MessageSettings";

type Tab = "photos" | "messages" | "triggers" | "display";

export default function App() {
  const [settings, setSettings] = useState<PetMoodSettings | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("photos");

  useEffect(() => {
    settingsStore.get().then(setSettings);
    const unsubscribe = settingsStore.onChange(setSettings);
    return unsubscribe;
  }, []);

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!settings.onboardingCompleted) {
    return <OnboardingPage />;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "photos", label: "Photos" },
    { key: "messages", label: "Messages" },
    { key: "triggers", label: "Notifications" },
    { key: "display", label: "Display" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">PetMood Settings</h1>
              <p className="text-sm text-gray-400">
                {settings.userName}, {settings.petName}'s owner
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {settings.isEnabled ? "On" : "Off"}
              </span>
              <button
                onClick={async () =>
                  settingsStore.set({ isEnabled: !settings.isEnabled })
                }
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
          </div>
          <nav className="flex gap-6 mt-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`text-sm pb-2 border-b-2 transition ${
                  activeTab === tab.key
                    ? "border-orange-500 text-orange-500 font-medium"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-6">
        {activeTab === "photos" && <PhotoManager />}
        {activeTab === "messages" && <MessageSettings settings={settings} />}
        {activeTab === "triggers" && <TriggerSettings settings={settings} />}
        {activeTab === "display" && <DisplaySettings settings={settings} />}
      </main>
    </div>
  );
}

function DisplaySettings({ settings }: { settings: PetMoodSettings }) {
  const positions = [
    { value: "top-right", label: "Top Right" },
    { value: "top-left", label: "Top Left" },
    { value: "bottom-right", label: "Bottom Right" },
    { value: "bottom-left", label: "Bottom Left" },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-medium mb-3">Notification Position</h3>
        <div className="grid grid-cols-2 gap-2">
          {positions.map((pos) => (
            <button
              key={pos.value}
              onClick={() =>
                settingsStore.set({
                  display: { ...settings.display, position: pos.value },
                })
              }
              className={`p-3 rounded-lg border text-sm transition ${
                settings.display.position === pos.value
                  ? "border-orange-500 bg-orange-50 text-orange-600"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-medium mb-3">Display Duration</h3>
        <select
          value={settings.display.displayDurationSeconds}
          onChange={(e) =>
            settingsStore.set({
              display: {
                ...settings.display,
                displayDurationSeconds: Number(e.target.value),
              },
            })
          }
          className="w-full p-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value={5}>5 sec</option>
          <option value={8}>8 sec</option>
          <option value={10}>10 sec</option>
          <option value={15}>15 sec</option>
        </select>
      </section>

      <section className="bg-white rounded-xl p-5 shadow-sm">
        <label className="flex items-center justify-between">
          <span className="font-medium">Running Animation</span>
          <input
            type="checkbox"
            checked={settings.display.showRunningAnimation}
            onChange={(e) =>
              settingsStore.set({
                display: {
                  ...settings.display,
                  showRunningAnimation: e.target.checked,
                },
              })
            }
            className="w-4 h-4 accent-orange-500"
          />
        </label>
        <p className="text-xs text-gray-400 mt-1">
          Pet runs across the screen for running category photos
        </p>
      </section>

      <section className="bg-white rounded-xl p-5 shadow-sm">
        <label className="flex items-center justify-between mb-3">
          <span className="font-medium">Active Hours</span>
          <input
            type="checkbox"
            checked={settings.activeHours.enabled}
            onChange={(e) =>
              settingsStore.set({
                activeHours: {
                  ...settings.activeHours,
                  enabled: e.target.checked,
                },
              })
            }
            className="w-4 h-4 accent-orange-500"
          />
        </label>
        {settings.activeHours.enabled && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="number"
              min={0}
              max={23}
              value={settings.activeHours.startHour}
              onChange={(e) =>
                settingsStore.set({
                  activeHours: {
                    ...settings.activeHours,
                    startHour: Number(e.target.value),
                  },
                })
              }
              className="w-16 p-2 border border-gray-200 rounded-lg text-center"
            />
            <span>h to</span>
            <input
              type="number"
              min={0}
              max={23}
              value={settings.activeHours.endHour}
              onChange={(e) =>
                settingsStore.set({
                  activeHours: {
                    ...settings.activeHours,
                    endHour: Number(e.target.value),
                  },
                })
              }
              className="w-16 p-2 border border-gray-200 rounded-lg text-center"
            />
            <span>h</span>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          No notifications outside these hours
        </p>
      </section>
    </div>
  );
}
