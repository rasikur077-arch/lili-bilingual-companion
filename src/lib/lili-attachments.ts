/**
 * Binary attachment storage for Lili chat.
 *
 * Keep image bytes in IndexedDB rather than localStorage. The chat store only
 * needs lightweight metadata; this module owns the actual Blob data.
 */
const DATABASE_NAME = "lili-attachments";
const DATABASE_VERSION = 1;
const STORE_NAME = "images";

export type StoredImage = {
  threadId: string;
  messageId: string;
  index: number;
  blob: Blob;
  mediaType: string;
  filename: string;
  savedAt: number;
};

function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Image storage is not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: ["threadId", "messageId", "index"],
        });
        store.createIndex("by-thread", "threadId", { unique: false });
        store.createIndex("by-message", ["threadId", "messageId"], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open image storage."));
    request.onblocked = () => reject(new Error("Image storage is blocked by another tab."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Image storage request failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Image storage transaction aborted."));
    });
  } finally {
    db.close();
  }
}

export async function saveChatImage(
  image: Omit<StoredImage, "savedAt">,
): Promise<void> {
  await withStore("readwrite", (store) => store.put({ ...image, savedAt: Date.now() }));
}

export async function getChatImages(
  threadId: string,
  messageId: string,
): Promise<StoredImage[]> {
  const rows = await withStore<StoredImage[]>("readonly", (store) =>
    store.index("by-message").getAll([threadId, messageId]),
  );
  return rows.sort((a, b) => a.index - b.index);
}

export async function deleteChatMessageImages(
  threadId: string,
  messageId: string,
): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const request = transaction.objectStore(STORE_NAME).index("by-message").openKeyCursor(
        IDBKeyRange.only([threadId, messageId]),
      );
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          transaction.objectStore(STORE_NAME).delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      request.onerror = () => reject(request.error ?? new Error("Could not remove chat images."));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("Image deletion was aborted."));
    });
  } finally {
    db.close();
  }
}

export async function deleteChatImages(threadId: string): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const request = transaction.objectStore(STORE_NAME).index("by-thread").openKeyCursor(
        IDBKeyRange.only(threadId),
      );
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          transaction.objectStore(STORE_NAME).delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      request.onerror = () => reject(request.error ?? new Error("Could not remove chat images."));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("Image deletion was aborted."));
    });
  } finally {
    db.close();
  }
}

export function imageBlobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read the saved image."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the saved image."));
    reader.readAsDataURL(blob);
  });
}
