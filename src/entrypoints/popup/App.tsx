import { useState, useEffect } from "react";
import { settingsStore } from "../../lib/storage/settings-store";
import { photoDB } from "../../lib/storage/photo-db";
import { sendToBackground } from "../../lib/messages/protocol";
import {
  selectMessage,
  getTimeContext,
  suggestActivity,
} from "../../lib/templates/selector";
import type { PetMoodSettings } from "../../types";

export default function App() {
  const [settings, setSettings] = useState<PetMoodSettings | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [testSending, setTestSending] = useState(false);

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

  const handleTestNotification = async () => {
    if (testSending) return;
    setTestSending(true);

    try {
      const hour = new Date().getHours();
      const timeCtx = getTimeContext(hour);
      const activity = suggestActivity(timeCtx, "timer");

      // Try to get a photo matching the activity, fallback to any
      let photo = await photoDB.getRandomPhoto(activity);
      if (!photo) photo = await photoDB.getRandomPhoto();

      if (!photo) {
        alert("사진을 먼저 등록해주세요!");
        return;
      }

      const { id, text } = selectMessage({
        activity: photo.activity,
        triggerType: "timer",
        currentHour: hour,
        userName: settings.userName,
        petName: settings.petName,
        recentMessageIds: [],
      });

      // Decide display type
      const displayType =
        photo.activity === "running" &&
        Math.random() > 0.5
          ? "running"
          : "card";

      // Send to active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        alert("알림을 표시할 탭이 없어요. 웹페이지를 열어주세요!");
        return;
      }

      await chrome.tabs.sendMessage(tab.id, {
        type: "SHOW_NOTIFICATION",
        payload: {
          imageDataUrl: photo.cutoutDataUrl,
          message: text,
          displayType,
          position: settings.display.position,
          durationSeconds: settings.display.displayDurationSeconds,
        },
      });
    } catch (err) {
      console.error("Test notification error:", err);
      alert("알림 전송 실패. 웹페이지에서 다시 시도해주세요.");
    } finally {
      setTestSending(false);
    }
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
      <div className="grid grid-cols-2 gap-2 mb-3">
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

      {/* Test Notification Button */}
      <button
        onClick={handleTestNotification}
        disabled={testSending}
        className="w-full bg-orange-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition disabled:bg-orange-300 mb-2"
      >
        {testSending ? "보내는 중..." : "테스트 알림 보내기"}
      </button>

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
