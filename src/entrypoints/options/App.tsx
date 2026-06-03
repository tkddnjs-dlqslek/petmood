import { useState, useEffect } from "react";
import { settingsStore } from "../../lib/storage/settings-store";
import type { PetMoodSettings } from "../../types";
import OnboardingPage from "./pages/OnboardingPage";
import PhotoManager from "./pages/PhotoManager";
import TriggerSettings from "./pages/TriggerSettings";
import CutoutEditorPage from "./pages/CutoutEditorPage";

type Tab = "photos" | "triggers";

export default function App() {
  // Read once — location.search never changes during the component's lifetime
  const editPhotoId = new URLSearchParams(location.search).get("editPhotoId");

  const [settings, setSettings] = useState<PetMoodSettings | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("photos");

  useEffect(() => {
    if (editPhotoId) return; // editor mode — no settings needed
    settingsStore.get().then(setSettings);
    const unsubscribe = settingsStore.onChange(setSettings);
    return unsubscribe;
  }, [editPhotoId]);

  // Standalone editor mode: options.html?editPhotoId=<id>
  if (editPhotoId) return <CutoutEditorPage photoId={editPhotoId} />;

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
    { key: "triggers", label: "Notifications" },
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
          </div>
          {/* Two tabs split the bar evenly for left/right symmetry. */}
          <nav className="flex mt-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 text-sm pb-2 border-b-2 transition ${
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
        {activeTab === "triggers" && <TriggerSettings settings={settings} />}
      </main>
    </div>
  );
}
