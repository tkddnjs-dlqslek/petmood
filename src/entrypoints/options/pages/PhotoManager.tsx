import { useState, useEffect, useRef } from "react";
import { photoDB } from "../../../lib/storage/photo-db";
import { removeBackgroundFromImage, preloadBgRemover } from "../../../lib/ai/processor";
import { fileToDataUrl, createThumbnail } from "../../../lib/image-utils";
import { compactLegacyCutouts } from "../../../lib/cutout-maintenance";
import type { StoredPhotoMeta } from "../../../types";

const MAX_TOTAL_PHOTOS = 100;

export default function PhotoManager() {
  const [photos, setPhotos] = useState<StoredPhotoMeta[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadPhotos();
    // Warm up the model in the background so it's ready when the user clicks "+ Add"
    preloadBgRemover().catch(() => {});
    // Heal legacy full-res cutouts in the background (idempotent, self-correcting)
    compactLegacyCutouts().catch((e) => console.error("[PetMood] compact failed:", e));
    const bc = new BroadcastChannel("petmood");
    bc.onmessage = (e) => {
      if (e.data?.type === "cutout-updated") loadPhotos();
    };
    return () => bc.close();
  }, []);

  const loadPhotos = async () => {
    const all = await photoDB.getAllPhotosMeta();
    setPhotos(all);
  };

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setProcessingMsg(`${i + 1}/${filesToProcess.length} Removing background...`);

      const [imageDataUrl, thumbnailDataUrl] = await Promise.all([
        fileToDataUrl(file),
        createThumbnail(file),
      ]);

      let cutoutDataUrl = imageDataUrl;
      try {
        cutoutDataUrl = await removeBackgroundFromImage(imageDataUrl, (msg) =>
          setProcessingMsg(`${i + 1}/${filesToProcess.length}: ${msg}`)
        );
      } catch (err) {
        console.error("[PetMood] Cutout failed:", err);
      }

      const arrayBuffer = await file.arrayBuffer();
      await photoDB.addPhoto({
        id: crypto.randomUUID(),
        originalBlob: new Blob([arrayBuffer]),
        cutoutDataUrl,
        thumbnailDataUrl,
        createdAt: Date.now(),
      });
    }

    setIsProcessing(false);
    setProcessingMsg("");
    loadPhotos();

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    await photoDB.deletePhoto(id);
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleEditClick = (photo: StoredPhotoMeta) => {
    const url = chrome.runtime.getURL(`options.html?editPhotoId=${photo.id}`);
    window.open(url, "_blank");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <span className="font-medium text-sm">
            My Photos <span className="text-gray-400 font-normal">{photos.length}/100</span>
          </span>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="text-xs bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg hover:bg-orange-200 transition disabled:opacity-50"
          >
            + Add
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

        {isProcessing && photos.length > 0 && (
          <div className="mx-4 mb-3 p-3 bg-orange-50 rounded-lg text-sm text-orange-600 animate-pulse">
            {processingMsg}
          </div>
        )}

        {photos.length > 0 ? (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.thumbnailDataUrl}
                    alt=""
                    loading="lazy"
                    className="w-full aspect-square object-cover rounded-lg bg-gray-100"
                  />
                  <button
                    onClick={() => handleEditClick(photo)}
                    className="absolute bottom-1 left-1 w-5 h-5 bg-white/90 rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition flex items-center justify-center shadow"
                    title="Edit cutout"
                  >
                    ✏️
                  </button>
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
        ) : (
          <div className="px-4 pb-6 text-center">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-sm text-orange-500">{processingMsg || "Processing..."}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-300">No photos yet. Add some!</p>
            )}
          </div>
        )}
    </div>
  );
}
