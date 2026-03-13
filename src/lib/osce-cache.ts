const DB_NAME = 'zyntra-osce-cache';
const STORE_NAME = 'stations';
const DB_VERSION = 1;
const MAX_STATIONS = 15;

export interface CachedStation {
  station_id: string;
  title: string;
  scenario_data: any;
  candidate_instructions: string | null;
  examiner_instructions: string | null;
  marking_checklist: any;
  subject: string;
  difficulty: string;
  cached_at: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'station_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedStations(): Promise<CachedStation[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function cacheStations(stations: CachedStation[]): Promise<void> {
  try {
    const db = await openDB();
    const existing = await getCachedStations();
    const existingIds = new Set(existing.map(s => s.station_id));

    const newStations = stations.filter(s => !existingIds.has(s.station_id));
    const totalAfter = existing.length + newStations.length;

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Remove oldest if exceeding limit
    if (totalAfter > MAX_STATIONS) {
      const sorted = [...existing].sort((a, b) => a.cached_at - b.cached_at);
      const toRemove = totalAfter - MAX_STATIONS;
      for (let i = 0; i < toRemove && i < sorted.length; i++) {
        store.delete(sorted[i].station_id);
      }
    }

    for (const station of newStations) {
      store.put(station);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to cache OSCE stations:', e);
  }
}

export async function removeCachedStation(stationId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(stationId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to remove cached station:', e);
  }
}

export async function getCacheCount(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to clear OSCE cache:', e);
  }
}
