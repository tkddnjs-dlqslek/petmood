import { openDB, type IDBPDatabase } from "idb";
import type { StoredPhoto, CachedModel, ActivityType } from "../../types";

const DB_NAME = "PetMoodDB";
const DB_VERSION = 1;

interface PetMoodDB {
  photos: {
    key: string;
    value: StoredPhoto;
    indexes: {
      "by-activity": ActivityType;
      "by-created": number;
    };
  };
  models: {
    key: string;
    value: CachedModel;
  };
}

let dbInstance: IDBPDatabase<PetMoodDB> | null = null;

async function getDB(): Promise<IDBPDatabase<PetMoodDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PetMoodDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Photos store
      const photoStore = db.createObjectStore("photos", { keyPath: "id" });
      photoStore.createIndex("by-activity", "activity");
      photoStore.createIndex("by-created", "createdAt");

      // Models cache store
      db.createObjectStore("models", { keyPath: "id" });
    },
  });

  return dbInstance;
}

// ===== Photo Operations =====

export const photoDB = {
  async addPhoto(photo: StoredPhoto): Promise<void> {
    const db = await getDB();
    await db.put("photos", photo);
  },

  async getPhoto(id: string): Promise<StoredPhoto | undefined> {
    const db = await getDB();
    return db.get("photos", id);
  },

  async getAllPhotos(): Promise<StoredPhoto[]> {
    const db = await getDB();
    return db.getAllFromIndex("photos", "by-created");
  },

  async getPhotosByActivity(activity: ActivityType): Promise<StoredPhoto[]> {
    const db = await getDB();
    return db.getAllFromIndex("photos", "by-activity", activity);
  },

  async getRandomPhoto(activity?: ActivityType): Promise<StoredPhoto | null> {
    const photos = activity
      ? await this.getPhotosByActivity(activity)
      : await this.getAllPhotos();

    if (photos.length === 0) return null;
    return photos[Math.floor(Math.random() * photos.length)];
  },

  async updateActivity(
    id: string,
    activity: ActivityType
  ): Promise<void> {
    const db = await getDB();
    const photo = await db.get("photos", id);
    if (!photo) return;
    photo.activity = activity;
    photo.userCorrected = true;
    await db.put("photos", photo);
  },

  async deletePhoto(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("photos", id);
  },

  async getPhotoCount(): Promise<number> {
    const db = await getDB();
    return db.count("photos");
  },
};

// ===== Model Cache Operations =====

export const modelCache = {
  async getModel(id: string): Promise<CachedModel | undefined> {
    const db = await getDB();
    return db.get("models", id);
  },

  async saveModel(model: CachedModel): Promise<void> {
    const db = await getDB();
    await db.put("models", model);
  },

  async deleteModel(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("models", id);
  },
};
