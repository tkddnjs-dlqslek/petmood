import { useState, useEffect } from "react";
import { settingsStore } from "../../lib/storage/settings-store";
import { photoDB } from "../../lib/storage/photo-db";
import type { PetMoodSettings } from "../../types";

export default function App() {
  const [settings, setSettings] = useState<PetMoodSettings | null>(null);
  const [photoCount, setPhotoCount] = useState(0);

  useEffect(() => {
    settingsStore.get().then(setSettings);
    photoDB.getPhotoCount().then(setPhotoCount);
    const unsubscribe = settingsStore.onChange(setSettings);
    return unsubscribe;
  }, []);

  if (!settings) {
    return (
      <div className="w-[300px] p-4 text-center text-gray-400">로딩 중...</div>
    );
  }

  if (!settings.onboardingCompleted) {
    return (
      <div className="w-[300px] p-6 text-center">
        <h2 className="text-lg font-bold mb-2">PetMood</h2>
        <p className="text-sm text-gray-500 mb-4">
          반려동물 사진을 등록하고 시작하세요!
        </p>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition"
        >
          시작하기
        </button>
      </div>
    );
  }

  const handleToggle = async () => {
    const newEnabled = !settings.isEnabled;
    await settingsStore.set({ isEnabled: newEnabled });
  };

  return (
    <div className="w-[300px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">PetMood</h2>
          <p className="text-xs text-gray-400">
            {settings.petName}이가 {settings.userName}을 응원해!
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
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{photoCount}</p>
          <p className="text-xs text-gray-500">등록된 사진</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">
            {settings.totalNotificationsShown}
          </p>
          <p className="text-xs text-gray-500">알림 횟수</p>
        </div>
      </div>

      {/* Quick Info */}
      <div className="text-xs text-gray-400 mb-3">
        {settings.triggers.timer.enabled && (
          <p>
            타이머: {settings.triggers.timer.intervalMinutes}분마다
          </p>
        )}
        {settings.triggers.browseDuration.enabled && (
          <p>
            브라우징: {settings.triggers.browseDuration.thresholdMinutes}분 후
          </p>
        )}
      </div>

      {/* Settings Link */}
      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        className="w-full text-center text-sm text-orange-500 hover:text-orange-600 py-2 border border-orange-200 rounded-lg transition"
      >
        설정 열기
      </button>
    </div>
  );
}
