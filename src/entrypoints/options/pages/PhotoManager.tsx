import { useState, useEffect, useRef } from "react";
import { photoDB } from "../../../lib/storage/photo-db";
import { sendToBackground } from "../../../lib/messages/protocol";
import type { StoredPhoto, ActivityType } from "../../../types";
import { ACTIVITY_TYPES } from "../../../types";

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  resting: "자는/누운",
  eating: "먹는 중",
  active: "뛰는/노는",
  alert: "앉은/서있는",
  relaxing: "편하게 쉬는",
  yawning: "하품/기지개",
};

export default function PhotoManager() {
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    const all = await photoDB.getAllPhotos();
    setPhotos(all.reverse()); // Newest first
  };

  const MAX_TOTAL_PHOTOS = 100;

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_TOTAL_PHOTOS - photos.length;
    if (remaining <= 0) {
      alert("사진은 최대 100장까지 등록할 수 있어요!");
      return;
    }
    const filesToProcess = files.slice(0, remaining);
    for (const file of filesToProcess) {
      const thumbnailDataUrl = await createThumbnail(file);
      const arrayBuffer = await file.arrayBuffer();

      // Send to Service Worker → Offscreen Document for AI processing
      const result: any = await sendToBackground({
        type: "PROCESS_PHOTO",
        payload: { imageArrayBuffer: arrayBuffer, fileName: file.name },
      });

      const cutoutDataUrl = result?.cutoutDataUrl ?? await fileToDataUrl(file);
      const activity = result?.classification?.activity ??
        ACTIVITY_TYPES[Math.floor(Math.random() * ACTIVITY_TYPES.length)];
      const confidence = result?.classification?.confidence ?? 0.5;

      const photo: StoredPhoto = {
        id: crypto.randomUUID(),
        originalBlob: new Blob([arrayBuffer]),
        cutoutBlob: new Blob([arrayBuffer]),
        cutoutDataUrl,
        thumbnailDataUrl,
        activity,
        confidence,
        userCorrected: false,
        petType: "dog",
        createdAt: Date.now(),
      };
      await photoDB.addPhoto(photo);
    }
    loadPhotos();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    await photoDB.deletePhoto(id);
    loadPhotos();
  };

  const handleActivityChange = async (id: string, activity: ActivityType) => {
    await photoDB.updateActivity(id, activity);
    setEditingId(null);
    loadPhotos();
  };

  return (
    <div>
      {/* Add Photos Button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">
          등록된 사진 ({photos.length}장)
        </h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition"
        >
          + 사진 추가
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleAddPhotos}
          className="hidden"
        />
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl">
          <p className="text-gray-400">등록된 사진이 없어요</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="bg-white rounded-xl overflow-hidden shadow-sm group"
            >
              <div className="relative">
                <img
                  src={photo.cutoutDataUrl}
                  alt="Pet"
                  className="w-full h-32 object-cover"
                />
                <button
                  onClick={() => handleDelete(photo.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                >
                  &times;
                </button>
              </div>
              <div className="p-3">
                {editingId === photo.id ? (
                  <select
                    value={photo.activity}
                    onChange={(e) =>
                      handleActivityChange(
                        photo.id,
                        e.target.value as ActivityType
                      )
                    }
                    onBlur={() => setEditingId(null)}
                    autoFocus
                    className="w-full text-xs p-1 border border-gray-200 rounded"
                  >
                    {ACTIVITY_TYPES.map((a) => (
                      <option key={a} value={a}>
                        {ACTIVITY_LABELS[a]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setEditingId(photo.id)}
                    className="text-xs text-gray-500 hover:text-orange-500 transition"
                  >
                    {ACTIVITY_LABELS[photo.activity]}
                    {photo.userCorrected && " (수정됨)"}
                    {" ✎"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
