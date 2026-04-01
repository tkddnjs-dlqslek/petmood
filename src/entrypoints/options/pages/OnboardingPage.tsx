import { useState, useRef } from "react";
import { settingsStore } from "../../../lib/storage/settings-store";
import { photoDB } from "../../../lib/storage/photo-db";
import { removeBackgroundFromImage } from "../../../lib/ai/processor";
import type { PetType, StoredPhoto, ActivityType } from "../../../types";
import { ACTIVITY_TYPES } from "../../../types";

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  happy: "Happy",
  eating: "Eating",
  running: "Running",
  sleeping: "Sleeping",
  sad: "Sad",
  angry: "Angry",
};

const ACTIVITY_EMOJI: Record<ActivityType, string> = {
  happy: "😊",
  eating: "🍽️",
  running: "🏃",
  sleeping: "😴",
  sad: "😢",
  angry: "😠",
};

type Step = "profile" | "upload" | "processing" | "done";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("profile");
  const [userName, setUserName] = useState("");
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState<PetType>("dog");

  // Category-based upload: { activity: File[] }
  const [categoryFiles, setCategoryFiles] = useState<
    Record<ActivityType, File[]>
  >(() => {
    const init: any = {};
    for (const a of ACTIVITY_TYPES) init[a] = [];
    return init;
  });

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleProfileNext = () => {
    if (!userName.trim() || !petName.trim()) return;
    setStep("upload");
  };

  const handleFileSelect = (
    activity: ActivityType,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = Array.from(e.target.files ?? []);
    setCategoryFiles((prev) => ({
      ...prev,
      [activity]: [...prev[activity], ...selected].slice(0, 10),
    }));
  };

  const removeFile = (activity: ActivityType, index: number) => {
    setCategoryFiles((prev) => ({
      ...prev,
      [activity]: prev[activity].filter((_, i) => i !== index),
    }));
  };

  const totalFiles = Object.values(categoryFiles).reduce(
    (sum, files) => sum + files.length,
    0
  );

  const handleProcess = async () => {
    if (totalFiles === 0) return;
    setStep("processing");
    setProcessing(true);
    setTotalCount(totalFiles);

    let count = 0;

    try {
      for (const activity of ACTIVITY_TYPES) {
        const files = categoryFiles[activity];
        for (const file of files) {
          count++;
          setProgress(
            `${ACTIVITY_LABELS[activity]} ${count}/${totalFiles} processing...`
          );

          const imageDataUrl = await fileToDataUrl(file);
          const thumbnailDataUrl = await createThumbnail(file);

          // Background removal only (no classification needed)
          let cutoutDataUrl = imageDataUrl;
          try {
            cutoutDataUrl = await removeBackgroundFromImage(
              imageDataUrl,
              (msg) => setProgress(`${count}/${totalFiles}: ${msg}`)
            );
          } catch (err) {
            console.error("[PetMood] 누끼 실패:", err);
          }

          const arrayBuffer = await file.arrayBuffer();
          const photo: StoredPhoto = {
            id: crypto.randomUUID(),
            originalBlob: new Blob([arrayBuffer]),
            cutoutBlob: new Blob([arrayBuffer]),
            cutoutDataUrl,
            thumbnailDataUrl,
            activity, // User-selected category!
            confidence: 1.0,
            userCorrected: false,
            petType,
            createdAt: Date.now(),
          };

          await photoDB.addPhoto(photo);
          setProcessedCount(count);
        }
      }

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
      setProgress(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full p-8">
        {/* Step 1: Profile */}
        {step === "profile" && (
          <div>
            <h1 className="text-2xl font-bold text-center mb-2">
              Welcome to PetMood!
            </h1>
            <p className="text-sm text-gray-400 text-center mb-8">
              Tell us about you and your pet
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  My Name
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pet Name
                </label>
                <input
                  type="text"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  placeholder="Enter your pet's name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What kind of pet?
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
                      {type === "dog" ? "🐕 Dog" : "🐈 Cat"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleProfileNext}
                disabled={!userName.trim() || !petName.trim()}
                className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium text-sm hover:bg-orange-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed mt-4"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Category-based Upload */}
        {step === "upload" && (
          <div>
            <h1 className="text-xl font-bold text-center mb-2">
              {petName}'s photos by category!
            </h1>
            <p className="text-sm text-gray-400 text-center mb-3">
              Add photos for each emotion (max 10 per category)
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-700">
              <strong>TIP:</strong> Close-up photos work best! Simpler backgrounds give cleaner cutouts.
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {ACTIVITY_TYPES.map((activity) => (
                <div
                  key={activity}
                  className="border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {ACTIVITY_EMOJI[activity]} {ACTIVITY_LABELS[activity]}
                    </span>
                    <button
                      onClick={() => fileInputRefs.current[activity]?.click()}
                      className="text-xs bg-orange-100 text-orange-600 px-3 py-1 rounded-lg hover:bg-orange-200 transition"
                    >
                      + Add Photos
                    </button>
                    <input
                      ref={(el) => { fileInputRefs.current[activity] = el; }}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileSelect(activity, e)}
                      className="hidden"
                    />
                  </div>

                  {categoryFiles[activity].length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {categoryFiles[activity].map((file, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt=""
                            className="w-14 h-14 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => removeFile(activity, i)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {categoryFiles[activity].length === 0 && (
                    <p className="text-xs text-gray-300">No photos yet</p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep("profile")}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                onClick={handleProcess}
                disabled={totalFiles === 0}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-medium text-sm hover:bg-orange-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Start! ({totalFiles} photos)
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === "processing" && (
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">Removing backgrounds...</h2>
            <p className="text-sm text-gray-400 mb-4">{progress}</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all"
                style={{
                  width: `${totalCount > 0 ? (processedCount / totalCount) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {processedCount}/{totalCount} done
            </p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="text-center py-8">
            <p className="text-5xl mb-4">🎉</p>
            <h2 className="text-xl font-bold mb-2">준비 done!</h2>
            <p className="text-sm text-gray-400 mb-6">
              {petName} is ready to cheer you on, {userName}!
              <br />
              {petName} will visit you while you browse~
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

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
