/**
 * Server Master Database Service (Client-Side)
 * Connects frontend to the Master Server Storage API:
 * - /api/database/status
 * - /api/employees
 * - /api/face-database
 * - /api/photos/:nomor_induk
 * - /api/settings
 * - /api/history
 * - /api/admin/* (upload-excel, upload-photos, save-embeddings, sync-all, backup, restore)
 */
import { Employee, AppSettings, RecognitionLog, ServerDatabaseStatus, ServerBackupInfo } from '../types';
import { saveEmployees, getAllEmployees, clearAllEmployees } from './database';
import { getStoredToken } from './authService';

function getAuthHeaders(includeContentType = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Safe JSON parser helper to prevent "Unexpected end of JSON input" errors
 */
async function safeReadJson<T = any>(res: Response): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const text = await res.text();
    if (!text || text.trim().length === 0) {
      return { ok: res.ok, status: res.status, data: null };
    }
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: null };
  }
}

/**
 * Fetch server database status (ready, version, employeeCount, photoCount, embeddingCount)
 */
export async function fetchServerStatus(): Promise<ServerDatabaseStatus | null> {
  try {
    const res = await fetch('/api/database/status', {
      headers: getAuthHeaders(false),
      credentials: 'include',
    });
    const { ok, data } = await safeReadJson<any>(res);
    if (!ok || !data) return null;
    return {
      ready: Boolean(data.ready),
      version: Number(data.version) || 1,
      employeeCount: Number(data.employeeCount) || 0,
      photoCount: Number(data.photoCount) || 0,
      embeddingCount: Number(data.embeddingCount) || 0,
      excelFileName: data.excelFileName,
      lastUpdated: data.lastUpdated || new Date().toISOString(),
      storageReady: Boolean(data.storageReady),
      storagePath: data.storagePath,
    };
  } catch (err) {
    console.warn('Failed to fetch server database status:', err);
    return null;
  }
}

/**
 * Fetch all employee records from master server database
 */
export async function fetchServerEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch('/api/employees', {
      headers: getAuthHeaders(false),
      credentials: 'include',
    });
    const { ok, data } = await safeReadJson<{ employees: Employee[] }>(res);
    if (!ok || !data) return [];
    return data.employees || [];
  } catch (err) {
    console.error('fetchServerEmployees error:', err);
    return [];
  }
}

/**
 * Fetch face embeddings dictionary from master server
 */
export async function fetchServerFaceDatabase(): Promise<{
  version: number;
  count: number;
  embeddings: Record<string, number[]>;
}> {
  try {
    const res = await fetch('/api/face-database', {
      headers: getAuthHeaders(false),
      credentials: 'include',
    });
    const { ok, data } = await safeReadJson<any>(res);
    if (!ok || !data) return { version: 1, count: 0, embeddings: {} };
    return {
      version: data.version || 1,
      count: data.count || 0,
      embeddings: data.embeddings || {},
    };
  } catch (err) {
    console.error('fetchServerFaceDatabase error:', err);
    return { version: 1, count: 0, embeddings: {} };
  }
}

/**
 * Sync client local IndexedDB cache with the Master Server Database.
 * This guarantees that when any computer (Komputer A, B, C) logs in,
 * the database is immediately downloaded and ready for 60fps real-time camera recognition.
 */
export async function syncClientWithServerMaster(): Promise<{
  synced: boolean;
  employeeCount: number;
  employees: Employee[];
  status: ServerDatabaseStatus | null;
}> {
  const status = await fetchServerStatus();
  if (!status || !status.ready || status.employeeCount === 0) {
    return { synced: false, employeeCount: 0, employees: [], status };
  }

  // Fetch employees and embeddings from server
  const [employees, faceDb] = await Promise.all([
    fetchServerEmployees(),
    fetchServerFaceDatabase(),
  ]);

  if (employees.length > 0) {
    // Attach embeddings to employees if separate
    const updatedEmployees = employees.map((emp) => {
      const desc = faceDb.embeddings[emp.nomor_induk] || emp.faceDescriptor;
      return {
        ...emp,
        faceDescriptor: desc,
        hasPhoto: emp.hasPhoto || Boolean(desc),
        photoStatus: desc ? ('ready' as const) : emp.photoStatus,
        // Set photoUrl to server endpoint if none exists
        photoUrl: emp.photoUrl || `/api/photos/${emp.nomor_induk}`,
      };
    });

    // Mirror cleanly into local IndexedDB
    try {
      await clearAllEmployees();
      await saveEmployees(updatedEmployees);
    } catch (e) {
      console.warn('Could not mirror to IndexedDB cache, running in-memory:', e);
    }
    console.log(`[CLIENT SYNC] Synchronized ${updatedEmployees.length} employees from Server Master.`);
    return {
      synced: true,
      employeeCount: updatedEmployees.length,
      employees: updatedEmployees,
      status,
    };
  }

  return { synced: false, employeeCount: 0, employees: [], status };
}

/**
 * Upload Excel file directly to Master Server
 */
export async function uploadExcelToServer(
  file: File,
  employees?: Employee[]
): Promise<{ success: boolean; message: string; version?: number }> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (employees && employees.length > 0) {
      formData.append('employees', JSON.stringify(employees));
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/admin/upload-excel', {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    const { ok, data } = await safeReadJson<any>(res);
    if (!ok || !data) {
      throw new Error(data?.error || 'Gagal mengunggah file Excel ke server.');
    }

    return {
      success: true,
      message: data.message || 'File Excel berhasil disimpan di server.',
      version: data.version,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengirim Excel ke server.',
    };
  }
}

/**
 * Upload batch of photos & embeddings to Master Server in robust chunks
 */
export async function uploadPhotosToServer(
  photos: Array<{
    nomorInduk: string;
    fileName?: string;
    base64?: string;
    descriptor?: number[];
  }>,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; message: string }> {
  try {
    if (!photos || photos.length === 0) {
      return { success: true, message: 'Tidak ada foto untuk diunggah.' };
    }

    const BATCH_SIZE = 15;
    let processed = 0;

    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      const batch = photos.slice(i, i + BATCH_SIZE);
      const res = await fetch('/api/admin/upload-photos', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ photos: batch }),
        credentials: 'include',
      });

      const { ok, data } = await safeReadJson<any>(res);
      if (!ok || !data) {
        throw new Error(data?.error || `Gagal mengunggah foto batch ${Math.floor(i / BATCH_SIZE) + 1} ke server.`);
      }

      processed += batch.length;
      if (onProgress) {
        onProgress(processed, photos.length);
      }
    }

    return {
      success: true,
      message: `Berhasil menyimpan ${processed} foto ke storage server.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengirim foto ke server.',
    };
  }
}

/**
 * Save embeddings directly to Master Server
 */
export async function saveEmbeddingsToServer(
  embeddings: Record<string, number[]>
): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/save-embeddings', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ embeddings }),
      credentials: 'include',
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to save embeddings to server:', err);
    return false;
  }
}

/**
 * Sync all local data (employees, embeddings, photos, settings, logs) to Server Master.
 * Used for 1-click migration of existing data to server storage!
 */
export async function syncAllDataToServer(): Promise<{
  success: boolean;
  message: string;
  status?: ServerDatabaseStatus;
}> {
  try {
    const employees = await getAllEmployees();
    const embeddings: Record<string, number[]> = {};
    const photos: Record<string, string> = {};

    for (const emp of employees) {
      if (emp.faceDescriptor && emp.faceDescriptor.length > 0) {
        embeddings[emp.nomor_induk] = emp.faceDescriptor;
      }
      if (emp.photoUrl && emp.photoUrl.startsWith('data:image')) {
        photos[emp.nomor_induk] = emp.photoUrl;
      }
    }

    const payload = {
      employees,
      embeddings,
      photos,
    };

    const res = await fetch('/api/admin/sync-all-to-server', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    const { ok, data } = await safeReadJson<any>(res);
    if (!ok || !data) {
      throw new Error(data?.error || 'Gagal sinkronisasi data ke server.');
    }

    return {
      success: true,
      message: data.message || 'Sinkronisasi berhasil!',
      status: data.status,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Gagal sinkronisasi ke server.',
    };
  }
}

/**
 * Create a persistent database backup on server
 */
export async function createDatabaseBackup(): Promise<ServerBackupInfo | null> {
  try {
    const res = await fetch('/api/admin/backup', {
      method: 'POST',
      headers: getAuthHeaders(true),
      credentials: 'include',
    });
    const { ok, data } = await safeReadJson<any>(res);
    if (ok && data && data.backup) {
      return data.backup;
    }
    return null;
  } catch (err) {
    console.error('createDatabaseBackup error:', err);
    return null;
  }
}

/**
 * List all persistent database backups on server
 */
export async function listDatabaseBackups(): Promise<ServerBackupInfo[]> {
  try {
    const res = await fetch('/api/admin/backups', {
      headers: getAuthHeaders(false),
      credentials: 'include',
    });
    const { data } = await safeReadJson<any>(res);
    return data?.backups || [];
  } catch (err) {
    console.error('listDatabaseBackups error:', err);
    return [];
  }
}

/**
 * Restore database from a backup ID
 */
export async function restoreDatabaseBackup(backupId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/restore', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ backupId }),
      credentials: 'include',
    });
    const { ok, data } = await safeReadJson<any>(res);
    if (ok) {
      // After restore on server, sync local cache
      await syncClientWithServerMaster();
      return true;
    }
    alert(data?.error || 'Gagal memulihkan database.');
    return false;
  } catch (err) {
    console.error('restoreDatabaseBackup error:', err);
    return false;
  }
}

/**
 * Reset server database
 */
export async function resetServerDatabase(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/database', {
      method: 'DELETE',
      headers: getAuthHeaders(false),
      credentials: 'include',
    });
    return res.ok;
  } catch (err) {
    console.error('resetServerDatabase error:', err);
    return false;
  }
}
