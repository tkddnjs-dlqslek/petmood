import { openDB, type IDBPDatabase } from "idb";
import type { StoredPhoto, StoredPhotoMeta } from "../../types";

const DB_NAME = "PetMoodDB";
const DB_VERSION = 3;

interface PetMoodDB {
  photos: {
    key: string;
    value: StoredPhotoMeta;
    indexes: { "by-created": number };
  };
  "photo-cutouts": {
    key: string;
    value: { id: string; cutoutDataUrl: string };
  };
}

let dbInstance: IDBPDatabase<PetMoodDB> | null = null;

async function getDB(): Promise<IDBPDatabase<PetMoodDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PetMoodDB>(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const photoStore = db.createObjectStore("photos", { keyPath: "id" });
        // Legacy by-activity index — created for older schema, never queried now.
        // Left in place so v1 users don't need a v4 migration just to drop it.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (photoStore as any).createIndex("by-activity", "activity");
        photoStore.createIndex("by-created", "createdAt");
      }
      if (oldVersion < 2) {
        db.createObjectStore("photo-cutouts", { keyPath: "id" });
      }
      if (oldVersion < 3) {
        // Move any cutoutDataUrl still embedded in the photos store into photo-cutouts.
        // Runs once per user — covers v1 records AND any v2 records the previous
        // (buggy, fire-and-forget) migration left behind.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const photosStore = tx.objectStore("photos" as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cutoutsStore = tx.objectStore("photo-cutouts" as any);
        let cursor = await photosStore.openCursor();
        let count = 0;
        while (cursor) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rec = cursor.value as any;
          if (rec.cutoutDataUrl) {
            await cutoutsStore.put({ id: rec.id, cutoutDataUrl: rec.cutoutDataUrl });
            const { cutoutDataUrl: _cd, ...clean } = rec;
            await cursor.update(clean);
            count++;
          }
          cursor = await cursor.continue();
        }
        if (count > 0) console.log(`[PetMood] Migrated ${count} photos to split-store schema`);
      }
    },
  });

  return dbInstance;
}

// ===== Photo Operations =====

export const photoDB = {
  async addPhoto(photo: StoredPhoto): Promise<void> {
    const db = await getDB();
    const { cutoutDataUrl, ...meta } = photo;
    const tx = db.transaction(["photos", "photo-cutouts"], "readwrite");
    await tx.objectStore("photos").put(meta);
    await tx.objectStore("photo-cutouts").put({ id: photo.id, cutoutDataUrl });
    await tx.done;
  },

  // Fast grid query — only reads photos store (no large cutoutDataUrl strings)
  async getAllPhotosMeta(): Promise<StoredPhotoMeta[]> {
    const db = await getDB();
    return db.getAllFromIndex("photos", "by-created");
  },

  // Full record with cutoutDataUrl — use only for editor / notifications
  async getPhoto(id: string): Promise<StoredPhoto | undefined> {
    const db = await getDB();
    const [meta, cutout] = await Promise.all([
      db.get("photos", id),
      db.get("photo-cutouts", id),
    ]);
    if (!meta) return undefined;
    // Fall back to an embedded cutoutDataUrl if the split-store record is missing
    return { ...meta, cutoutDataUrl: cutout?.cutoutDataUrl ?? meta.cutoutDataUrl ?? "" };
  },

  // Cheap bulk read of just the cutout entries — for size checks during
  // compaction, avoiding the photos store entirely.
  async getAllCutoutEntries(): Promise<{ id: string; cutoutDataUrl: string }[]> {
    const db = await getDB();
    return db.getAll("photo-cutouts");
  },

  // Replace just the cutout image — for editor saves and compaction
  async setCutout(id: string, cutoutDataUrl: string): Promise<void> {
    const db = await getDB();
    await db.put("photo-cutouts", { id, cutoutDataUrl });
  },

  async deletePhoto(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(["photos", "photo-cutouts"], "readwrite");
    await tx.objectStore("photos").delete(id);
    await tx.objectStore("photo-cutouts").delete(id);
    await tx.done;
  },

  async getPhotoCount(): Promise<number> {
    const db = await getDB();
    return db.count("photos");
  },
};
