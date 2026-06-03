import { useState, useEffect, useRef } from "react";
import { settingsStore } from "../../../lib/storage/settings-store";
import { photoDB } from "../../../lib/storage/photo-db";
import { removeBackgroundFromImage, preloadBgRemover } from "../../../lib/ai/processor";
import { fileToDataUrl, createThumbnail } from "../../../lib/image-utils";
import type { StoredPhoto } from "../../../types";

type Step = "profile" | "upload" | "processing" | "done";

const MAX_PHOTOS = 100;

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("profile");
  const [userName, setUserName] = useState("");
  const [petName, setPetName] = useState("");

  const [files, setFiles] = useState<File[]>([]);

  const [progress, setProgress] = useState("");
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef<Map<File, string>>(new Map());

  const getPreviewUrl = (file: File) => {
    if (!previewUrlsRef.current.has(file)) {
      previewUrlsRef.current.set(file, URL.createObjectURL(file));
    }
    return previewUrlsRef.current.get(file)!;
  };

  // Revoke all preview object URLs on unmount
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleProfileNext = () => {
    if (!userName.trim() || !petName.trim()) return;
    setStep("upload");
    // Start loading the model while the user picks photos
    preloadBgRemover().catch(() => {});
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected].slice(0, MAX_PHOTOS));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    const file = files[index];
    const url = previewUrlsRef.current.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(file);
    }
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setStep("processing");
    setTotalCount(files.length);

    let count = 0;
    const failures: { name: string; error: string }[] = [];

    try {
      for (const file of files) {
        count++;
        setProgress(`${count}/${files.length} processing...`);

        const [imageDataUrl, thumbnailDataUrl] = await Promise.all([
          fileToDataUrl(file),
          createThumbnail(file),
        ]);

        // Skip the photo entirely on background-removal failure rather than
        // storing the raw JPEG as a fake cutout.
        let cutoutDataUrl: string;
        try {
          cutoutDataUrl = await removeBackgroundFromImage(
            imageDataUrl,
            (msg) => setProgress(`${count}/${files.length}: ${msg}`)
          );
        } catch (err) {
          console.error("[PetMood] Cutout failed:", err);
          failures.push({ name: file.name, error: String(err) });
          setProcessedCount(count);
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const photo: StoredPhoto = {
          id: crypto.randomUUID(),
          originalBlob: new Blob([arrayBuffer]),
          cutoutDataUrl,
          thumbnailDataUrl,
          createdAt: Date.now(),
        };

        await photoDB.addPhoto(photo);
        setProcessedCount(count);
      }

      if (failures.length > 0) {
        setProgress(
          `Background removal failed for ${failures.length} photo(s) (model load or processing error). The other ${count - failures.length} were saved.`
        );
        await new Promise((r) => setTimeout(r, 2000));
      }

      await settingsStore.set({
        userName: userName.trim(),
        petName: petName.trim(),
        isEnabled: true,
        onboardingCompleted: true,
      });

      setStep("done");
    } catch (error) {
      console.error("Processing error:", error);
      setProgress(`Error: ${error}`);
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

        {/* Step 2: Bulk Upload */}
        {step === "upload" && (
          <div>
            <h1 className="text-xl font-bold text-center mb-2">
              Upload {petName}'s photos!
            </h1>
            <p className="text-sm text-gray-400 text-center mb-3">
              Add up to {MAX_PHOTOS} photos
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-700">
              <strong>TIP:</strong> Close-up photos work best — simpler backgrounds give cleaner cutouts.
            </div>

            <div className="border border-gray-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">
                  {files.length}/{MAX_PHOTOS} photos
                </span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={files.length >= MAX_PHOTOS}
                  className="text-xs bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg hover:bg-orange-200 transition disabled:opacity-50"
                >
                  + Add Photos
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {files.length > 0 ? (
                <div className="grid grid-cols-5 gap-2 max-h-[320px] overflow-y-auto pr-1">
                  {files.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="relative group">
                      <img
                        src={getPreviewUrl(file)}
                        alt=""
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-300 text-center py-6">No photos yet — click "+ Add Photos"</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("profile")}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                onClick={handleProcess}
                disabled={files.length === 0}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-medium text-sm hover:bg-orange-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Start! ({files.length} photos)
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
            <h2 className="text-xl font-bold mb-2">All set!</h2>
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
