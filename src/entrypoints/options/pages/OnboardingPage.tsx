import { useState, useRef } from "react";
import { settingsStore } from "../../../lib/storage/settings-store";
import { photoDB } from "../../../lib/storage/photo-db";
import { sendToBackground } from "../../../lib/messages/protocol";
import type { PetType, StoredPhoto, ActivityType } from "../../../types";
import { ACTIVITY_TYPES } from "../../../types";

type Step = "profile" | "upload" | "processing" | "done";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("profile");
  const [userName, setUserName] = useState("");
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState<PetType>("dog");
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [processedCount, setProcessedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProfileNext = () => {
    if (!userName.trim() || !petName.trim()) return;
    setStep("upload");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected].slice(0, 20)); // Max 20 photos
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAndProcess = async () => {
    if (files.length === 0) return;
    setStep("processing");
    setProcessing(true);

    // Listen for progress updates
    const progressListener = (message: { type: string; payload?: { message?: string } }) => {
      if (message.type === "INFERENCE_PROGRESS" && message.payload?.message) {
        setProgress(message.payload.message);
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(`사진 ${i + 1}/${files.length} 처리 중...`);

        const imageDataUrl = await fileToDataUrl(files[i]);
        const thumbnailDataUrl = await createThumbnail(files[i]);

        // Send to Service Worker → Offscreen Document for AI processing
        const result: any = await sendToBackground({
          type: "PROCESS_PHOTO",
          payload: { imageDataUrl, fileName: files[i].name },
        });

        // Use AI results if available, fallback to original image
        const cutoutDataUrl = result?.cutoutDataUrl ?? imageDataUrl;
        const activity = result?.classification?.activity ??
          ACTIVITY_TYPES[Math.floor(Math.random() * ACTIVITY_TYPES.length)];
        const confidence = result?.classification?.confidence ?? 0.5;

        const arrayBuffer = await files[i].arrayBuffer();
        const photo: StoredPhoto = {
          id: crypto.randomUUID(),
          originalBlob: new Blob([arrayBuffer]),
          cutoutBlob: new Blob([arrayBuffer]),
          cutoutDataUrl,
          thumbnailDataUrl,
          activity: activity as ActivityType,
          confidence,
          userCorrected: false,
          petType,
          createdAt: Date.now(),
        };

        await photoDB.addPhoto(photo);
        setProcessedCount(i + 1);
      }

      // Save settings
      await settingsStore.set({
        userName: userName.trim(),
        petName: petName.trim(),
        petType,
        isEnabled: true,
        onboardingCompleted: true,
      });

      setStep("done");
    } catch (error) {
      console.error("Processing error:", error);
      setProgress(`오류 발생: ${error}`);
    } finally {
      chrome.runtime.onMessage.removeListener(progressListener);
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        {/* Step 1: Profile */}
        {step === "profile" && (
          <div>
            <h1 className="text-2xl font-bold text-center mb-2">
              PetMood에 오신 걸 환영해요!
            </h1>
            <p className="text-sm text-gray-400 text-center mb-8">
              당신과 반려동물의 정보를 알려주세요
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  내 이름
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  반려동물 이름
                </label>
                <input
                  type="text"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  placeholder="반려동물 이름을 입력하세요"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  어떤 동물인가요?
                </label>
                <div className="flex gap-3">
                  {(["dog", "cat"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setPetType(type)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition ${
                        petType === type
                          ? "border-orange-500 bg-orange-50 text-orange-600"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {type === "dog" ? "강아지" : "고양이"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleProfileNext}
                disabled={!userName.trim() || !petName.trim()}
                className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium text-sm hover:bg-orange-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed mt-4"
              >
                다음
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Photo Upload */}
        {step === "upload" && (
          <div>
            <h1 className="text-2xl font-bold text-center mb-2">
              {petName}의 사진을 올려주세요!
            </h1>
            <p className="text-sm text-gray-400 text-center mb-6">
              다양한 모습의 사진을 올리면 더 재밌어요
              <br />
              (자는 모습, 뛰는 모습, 먹는 모습 등)
            </p>

            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 transition"
            >
              <p className="text-3xl mb-2">📷</p>
              <p className="text-sm text-gray-500">
                클릭하여 사진을 선택하세요
              </p>
              <p className="text-xs text-gray-400 mt-1">
                최대 20장, JPG/PNG
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Preview Grid */}
            {files.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">
                  {files.length}장 선택됨
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {files.map((file, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Pet ${i + 1}`}
                        className="w-full h-16 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep("profile")}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
              >
                이전
              </button>
              <button
                onClick={handleUploadAndProcess}
                disabled={files.length === 0}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-medium text-sm hover:bg-orange-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                시작하기!
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === "processing" && (
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">사진 처리 중...</h2>
            <p className="text-sm text-gray-400 mb-4">{progress}</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all"
                style={{
                  width: `${
                    files.length > 0
                      ? (processedCount / files.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {processedCount}/{files.length} 완료
            </p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="text-center py-8">
            <p className="text-5xl mb-4">🎉</p>
            <h2 className="text-xl font-bold mb-2">준비 완료!</h2>
            <p className="text-sm text-gray-400 mb-6">
              이제 {petName}이가 {userName}을 응원할 준비가 됐어요!
              <br />
              브라우징하다 보면 {petName}이가 찾아올 거예요~
            </p>
            <p className="text-xs text-gray-400">
              이 페이지에서 사진을 추가하거나 설정을 변경할 수 있어요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Utilities =====

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createThumbnail(file: File, size = 64): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = URL.createObjectURL(file);
  });
}
