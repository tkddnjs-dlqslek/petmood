import { useEffect, useState, useRef } from "react";
import { photoDB } from "../../../lib/storage/photo-db";
import type { StoredPhoto } from "../../../types";
import CutoutEditor from "./CutoutEditor";

export default function CutoutEditorPage({ photoId }: { photoId: string }) {
  const [photo, setPhoto] = useState<StoredPhoto | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const objUrlRef = useRef<string | null>(null);

  useEffect(() => {
    photoDB.getPhoto(photoId).then((p) => {
      if (!p) return;
      setPhoto(p);
      // Create object URL for original blob (for restore brush)
      const url = URL.createObjectURL(p.originalBlob);
      objUrlRef.current = url;
      setOriginalUrl(url);
    });
    return () => {
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    };
  }, [photoId]);

  if (!photo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  const handleConfirm = async (finalUrl: string) => {
    await photoDB.setCutout(photoId, finalUrl);
    const bc = new BroadcastChannel("petmood");
    bc.postMessage({ type: "cutout-updated", photoId });
    setTimeout(() => { bc.close(); window.close(); }, 150);
  };

  const handleCancel = () => window.close();

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <CutoutEditor
        originalUrl={originalUrl ?? photo.cutoutDataUrl}
        cutoutUrl={photo.cutoutDataUrl}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
