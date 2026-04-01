import { useState, useEffect, useRef } from "react";
import { photoDB } from "../../../lib/storage/photo-db";
import { removeBackgroundFromImage } from "../../../lib/ai/processor";
import type { StoredPhoto, ActivityType } from "../../../types";
import { ACTIVITY_TYPES } from "../../../types";

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  happy: "Happy",
  eating: "Eating",
  running: "Running",
  sleeping: "Sleeping",
  sad: "Sad",
  angry: "Angry",
};

const MAX_TOTAL_PHOTOS = 100;

export default function PhotoManager() {
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<ActivityType | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    const all = await photoDB.getAllPhotos();
    setPhotos(all);
  };

  const photosBy = (activity: ActivityType) =>
    photos.filter((p) => p.activity === activity);

  const handleAddPhotos = async (
    activity: ActivityType,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const remaining = MAX_TOTAL_PHOTOS - photos.length;
    if (remaining <= 0) {
      alert("You can register up to 100 photos!");
      return;
    }

    setIsProcessing(true);
    const filesToProcess = files.slice(0, remaining);

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      setProcessingMsg(`${ACTIVITY_LABELS[activity]} ${i + 1}/${filesToProcess.length} Removing backgrounds...`);

      const imageDataUrl = await fileToDataUrl(file);
      const thumbnailDataUrl = await createThumbnail(file);

      let cutoutDataUrl = imageDataUrl;
      try {
        cutoutDataUrl = await removeBackgroundFromImage(imageDataUrl, (msg) =>
          setProcessingMsg(`${ACTIVITY_LABELS[activity]} ${i + 1}/${filesToProcess.length}: ${msg}`)
        );
      } catch (err) {
        console.error("[PetMood] 누끼 실패:", err);
      }

      const arrayBuffer = await file.arrayBuffer();
      await photoDB.addPhoto({
        id: crypto.randomUUID(),
        originalBlob: new Blob([arrayBuffer]),
        cutoutBlob: new Blob([arrayBuffer]),
        cutoutDataUrl,
        thumbnailDataUrl,
        activity,
        confidence: 1.0,
        userCorrected: false,
        petType: "dog",
        createdAt: Date.now(),
      });
    }

    setIsProcessing(false);
    setProcessingMsg("");
    loadPhotos();

    const ref = fileInputRefs.current[activity];
    if (ref) ref.value = "";
  };

  const handleDelete = async (id: string) => {
    await photoDB.deletePhoto(id);
    loadPhotos();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Registered Photos ({photos.length}/100)</h3>
      </div>

      {isProcessing && (
        <div className="mb-4 p-3 bg-orange-50 rounded-lg text-sm text-orange-600 animate-pulse">
          {processingMsg}
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-3">
        {ACTIVITY_TYPES.map((activity) => {
          const categoryPhotos = photosBy(activity);
          const isExpanded = expandedCategory === activity;

          return (
            <div
              key={activity}
              className="bg-white rounded-xl shadow-sm overflow-hidden"
            >
              {/* Category header */}
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() =>
                    setExpandedCategory(isExpanded ? null : activity)
                  }
                  className="flex items-center gap-2"
                >
                  <span className="font-medium text-sm">
                    {ACTIVITY_LABELS[activity]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {categoryPhotos.length}장
                  </span>
                  {categoryPhotos.length >= 2 && (
                    <span className="text-xs text-gray-300">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  {/* Preview thumbnails (max 4) */}
                  {!isExpanded && categoryPhotos.length > 0 && (
                    <div className="flex -space-x-2">
                      {categoryPhotos.slice(0, 4).map((p) => (
                        <img
                          key={p.id}
                          src={p.thumbnailDataUrl}
                          className="w-8 h-8 rounded-full border-2 border-white object-cover"
                        />
                      ))}
                      {categoryPhotos.length > 4 && (
                        <span className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">
                          +{categoryPhotos.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Add button */}
                  <button
                    onClick={() => fileInputRefs.current[activity]?.click()}
                    disabled={isProcessing}
                    className="text-xs bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg hover:bg-orange-200 transition disabled:opacity-50"
                  >
                    + Add
                  </button>
                  <input
                    ref={(el) => {
                      fileInputRefs.current[activity] = el;
                    }}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleAddPhotos(activity, e)}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Expanded photo grid */}
              {isExpanded && categoryPhotos.length > 0 && (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {categoryPhotos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.cutoutDataUrl}
                          alt=""
                          className="w-full aspect-square object-cover rounded-lg"
                        />
                        <button
                          onClick={() => handleDelete(photo.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition flex items-center justify-center shadow"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {isExpanded && categoryPhotos.length === 0 && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-gray-300 text-center py-4">
                    No photos yet
                  </p>
                </div>
              )}
            </div>
          );
        })}
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
