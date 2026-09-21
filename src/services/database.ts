/**
 * Local IndexedDB database service for persistent employee face embeddings, records, and logs.
 */
import { Employee, RecognitionLog, AppSettings, DatabaseStats } from '../types';

const DB_NAME = 'EmployeeFaceRecognitionDB';
const DB_VERSION = 1;

const STORE_EMPLOYEES = 'employees';
const STORE_LOGS = 'recognition_logs';
const STORE_SETTINGS = 'settings';

export const DEFAULT_SETTINGS: AppSettings = {
  matchThreshold: 0.50, // 0.40 = strict, 0.50 = balanced default, 0.60 = lenient
  detectorType: 'ssdMobilenetv1',
  confirmationFrames: 3,
  detectionIntervalMs: 150,
  selectedCameraId: '',
  enableAntiSpoofing: true,
  beepOnRecognize: true,
  cooldownPeriodSeconds: 5,
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_EMPLOYEES)) {
        const empStore = db.createObjectStore(STORE_EMPLOYEES, { keyPath: 'nomor_induk' });
        empStore.createIndex('nama', 'nama', { unique: false });
        empStore.createIndex('unit_kerja', 'unit_kerja', { unique: false });
        empStore.createIndex('hasPhoto', 'hasPhoto', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        const logStore = db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
        logStore.createIndex('nomor_induk', 'nomor_induk', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllEmployees(): Promise<Employee[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EMPLOYEES, 'readonly');
    const store = tx.objectStore(STORE_EMPLOYEES);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getEmployeeById(nomor_induk: string): Promise<Employee | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EMPLOYEES, 'readonly');
    const store = tx.objectStore(STORE_EMPLOYEES);
    const req = store.get(nomor_induk);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveEmployees(employees: Employee[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EMPLOYEES, 'readwrite');
    const store = tx.objectStore(STORE_EMPLOYEES);

    for (const emp of employees) {
      store.put(emp);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function upsertEmployee(employee: Employee): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EMPLOYEES, 'readwrite');
    const store = tx.objectStore(STORE_EMPLOYEES);
    const req = store.put(employee);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteEmployee(nomor_induk: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EMPLOYEES, 'readwrite');
    const store = tx.objectStore(STORE_EMPLOYEES);
    const req = store.delete(nomor_induk);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllEmployees(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EMPLOYEES, 'readwrite');
    const store = tx.objectStore(STORE_EMPLOYEES);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllEmbeddings(): Promise<void> {
  const employees = await getAllEmployees();
  const updated = employees.map(emp => ({
    ...emp,
    faceDescriptor: undefined,
    photoStatus: emp.hasPhoto ? ('error' as const) : ('no_photo' as const),
    photoError: 'Embedding telah dihapus. Silakan re-import foto untuk membuat embedding baru.',
    updatedAt: Date.now()
  }));
  await saveEmployees(updated);
}

export async function getAllLogs(): Promise<RecognitionLog[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LOGS, 'readonly');
    const store = tx.objectStore(STORE_LOGS);
    const req = store.getAll();
    req.onsuccess = () => {
      const list: RecognitionLog[] = req.result || [];
      list.sort((a, b) => b.timestamp - a.timestamp); // Newest first
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function addRecognitionLog(log: RecognitionLog): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LOGS, 'readwrite');
    const store = tx.objectStore(STORE_LOGS);
    const req = store.add(log);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllLogs(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LOGS, 'readwrite');
    const store = tx.objectStore(STORE_LOGS);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getStoredSettings(): Promise<AppSettings> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get('app_settings');
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve({ ...DEFAULT_SETTINGS, ...req.result.value });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      };
      req.onerror = () => resolve(DEFAULT_SETTINGS);
    });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveStoredSettings(settings: AppSettings): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    const store = tx.objectStore(STORE_SETTINGS);
    const req = store.put({ key: 'app_settings', value: settings });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function calculateDatabaseStats(empList?: Employee[]): Promise<DatabaseStats> {
  const employees = empList && empList.length > 0 ? empList : await getAllEmployees();
  
  let totalPhotos = 0;
  let connected = 0;
  let photoNotFoundInExcel = 0;
  let excelWithoutPhoto = 0;
  let photoFailed = 0;
  let embeddingReady = 0;

  for (const emp of employees) {
    if (emp.hasPhoto) {
      totalPhotos++;
      if (emp.faceDescriptor && emp.faceDescriptor.length > 0) {
        embeddingReady++;
      }
    }
    
    // Check if this record is a photo-only dummy (i.e. not yet in Excel)
    const isPhotoOnly = emp.extraFields?._isPhotoOnly === 'true' || !emp.nama;
    if (isPhotoOnly) {
      photoNotFoundInExcel++;
    } else {
      if (emp.hasPhoto) {
        connected++;
      } else {
        excelWithoutPhoto++;
      }
    }

    if (emp.photoStatus === 'no_face' || emp.photoStatus === 'error') {
      photoFailed++;
    }
  }

  const totalExcel = employees.filter(e => !(e.extraFields?._isPhotoOnly === 'true') && e.nama).length;

  return {
    totalExcel,
    totalPhotos,
    connected,
    photoNotFoundInExcel,
    excelWithoutPhoto,
    photoFailed,
    embeddingReady,
  };
}
