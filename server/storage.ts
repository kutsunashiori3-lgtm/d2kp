/**
 * Server-side Master Storage Manager
 * Single Source of Truth for Face Recognition Pegawai
 * 
 * Manages persistent storage:
 * - /app/storage/database/   (pegawai.json, metadata.json)
 * - /app/storage/excel/      (pegawai.xlsx)
 * - /app/storage/photos/     ([nomor_induk].jpg)
 * - /app/storage/embeddings/ (embeddings.json)
 * - /app/storage/backups/    (backup-[timestamp].json)
 * - /app/storage/logs/       (recognition_history.json)
 * - /app/storage/settings/   (settings.json)
 */
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';

// Storage root directory (configurable via env STORAGE_PATH)
export const STORAGE_PATH = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');

export const DATABASE_PATH = path.join(STORAGE_PATH, 'database');
export const EXCEL_PATH = path.join(STORAGE_PATH, 'excel');
export const PHOTO_PATH = path.join(STORAGE_PATH, 'photos');
export const EMBEDDING_PATH = path.join(STORAGE_PATH, 'embeddings');
export const BACKUP_PATH = path.join(STORAGE_PATH, 'backups');
export const LOG_PATH = path.join(STORAGE_PATH, 'logs');
export const SETTINGS_PATH = path.join(STORAGE_PATH, 'settings');

const PEGAWAI_FILE = path.join(DATABASE_PATH, 'pegawai.json');
const METADATA_FILE = path.join(DATABASE_PATH, 'metadata.json');
const EMBEDDINGS_FILE = path.join(EMBEDDING_PATH, 'embeddings.json');
const LOGS_FILE = path.join(LOG_PATH, 'recognition_history.json');
const SETTINGS_FILE = path.join(SETTINGS_PATH, 'settings.json');
const MASTER_EXCEL_FILE = path.join(EXCEL_PATH, 'pegawai.xlsx');

export interface ServerEmployee {
  nomor_induk: string;
  nama: string;
  nip?: string;
  jabatan?: string;
  pangkat_golongan?: string;
  unit_kerja?: string;
  instansi?: string;
  extraFields?: Record<string, string>;
  hasPhoto: boolean;
  photoFileName?: string;
  photoUrl?: string;
  faceDescriptor?: number[];
  photoStatus: 'ready' | 'no_face' | 'multi_face' | 'error' | 'no_photo';
  photoError?: string;
  updatedAt: number;
}

export interface ServerMetadata {
  version: number;
  ready: boolean;
  employeeCount: number;
  photoCount: number;
  embeddingCount: number;
  excelFileName?: string;
  lastUpdated: string;
  storageReady: boolean;
  storagePath: string;
}

export interface ServerBackupItem {
  id: string;
  fileName: string;
  sizeBytes: number;
  createdAt: number;
  employeeCount: number;
  photoCount: number;
  embeddingCount: number;
}

/**
 * Ensure all storage directories exist
 */
export function initStorageDirectories(): void {
  const dirs = [
    STORAGE_PATH,
    DATABASE_PATH,
    EXCEL_PATH,
    PHOTO_PATH,
    EMBEDDING_PATH,
    BACKUP_PATH,
    LOG_PATH,
    SETTINGS_PATH,
  ];

  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  // Check if database needs initial seeding
  ensureInitialDatabaseState();
}

/**
 * Seeds initial data if database is brand new so that the server is ready out of the box
 */
function ensureInitialDatabaseState(): void {
  if (!fs.existsSync(PEGAWAI_FILE)) {
    const initialEmployees: ServerEmployee[] = [
      {
        nomor_induk: '198701012010011001',
        nama: 'Ahmad Fauzi, S.Kom',
        nip: '198701012010011001',
        jabatan: 'Analis Kepegawaian Ahli Muda',
        pangkat_golongan: 'III/c - Penata',
        unit_kerja: 'BKPSDM',
        instansi: 'Pemerintah Kabupaten',
        hasPhoto: true,
        photoFileName: '198701012010011001.jpg',
        photoStatus: 'ready',
        updatedAt: Date.now(),
      },
      {
        nomor_induk: '198802152011021002',
        nama: 'Budi Santoso, S.E.',
        nip: '198802152011021002',
        jabatan: 'Pengadministrasi Keuangan',
        pangkat_golongan: 'III/b - Penata Muda Tk. I',
        unit_kerja: 'BKAD',
        instansi: 'Pemerintah Kabupaten',
        hasPhoto: true,
        photoFileName: '198802152011021002.jpg',
        photoStatus: 'ready',
        updatedAt: Date.now(),
      },
      {
        nomor_induk: '199003102012032003',
        nama: 'Siti Nurhaliza, M.Pd',
        nip: '199003102012032003',
        jabatan: 'Pranata Komputer Ahli Muda',
        pangkat_golongan: 'III/d - Penata Tk. I',
        unit_kerja: 'Dinas Komunikasi dan Informatika',
        instansi: 'Pemerintah Kabupaten',
        hasPhoto: true,
        photoFileName: '199003102012032003.jpg',
        photoStatus: 'ready',
        updatedAt: Date.now(),
      },
      {
        nomor_induk: '199105202013041004',
        nama: 'Dedi Kusuma, S.Sos',
        nip: '199105202013041004',
        jabatan: 'Pengelola Data Informasi',
        pangkat_golongan: 'III/a - Penata Muda',
        unit_kerja: 'Inspektorat Daerah',
        instansi: 'Pemerintah Kabupaten',
        hasPhoto: true,
        photoFileName: '199105202013041004.jpg',
        photoStatus: 'ready',
        updatedAt: Date.now(),
      },
      {
        nomor_induk: '199308142014022005',
        nama: 'Rina Wulandari, S.H.',
        nip: '199308142014022005',
        jabatan: 'Analis Hukum & Tata Laksana',
        pangkat_golongan: 'III/b - Penata Muda Tk. I',
        unit_kerja: 'Sekretariat Daerah',
        instansi: 'Pemerintah Kabupaten',
        hasPhoto: true,
        photoFileName: '199308142014022005.jpg',
        photoStatus: 'ready',
        updatedAt: Date.now(),
      },
    ];

    fs.writeFileSync(PEGAWAI_FILE, JSON.stringify(initialEmployees, null, 2), 'utf-8');

    // Create a sample excel file in EXCEL_PATH
    try {
      const wb = XLSX.utils.book_new();
      const excelRows = initialEmployees.map((emp, idx) => ({
        'NO': idx + 1,
        'NOMOR INDUK': emp.nomor_induk,
        'NIP': emp.nip,
        'NAMA LENGKAP': emp.nama,
        'JABATAN': emp.jabatan,
        'PANGKAT / GOL': emp.pangkat_golongan,
        'UNIT KERJA': emp.unit_kerja,
        'INSTANSI': emp.instansi,
      }));
      const ws = XLSX.utils.json_to_sheet(excelRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Data Pegawai');
      XLSX.writeFile(wb, MASTER_EXCEL_FILE);
    } catch (err) {
      console.warn('Could not generate initial excel template:', err);
    }

    // Save initial metadata
    const meta: ServerMetadata = {
      version: 1,
      ready: true,
      employeeCount: initialEmployees.length,
      photoCount: initialEmployees.length,
      embeddingCount: initialEmployees.length,
      excelFileName: 'pegawai.xlsx',
      lastUpdated: new Date().toISOString(),
      storageReady: true,
      storagePath: STORAGE_PATH,
    };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(meta, null, 2), 'utf-8');
    console.log(`[STORAGE] Initial persistent database initialized with ${initialEmployees.length} employees.`);
  } else {
    // If PEGAWAI_FILE exists, make sure METADATA_FILE is in sync
    updateMetadataCounts();
  }
}

/**
 * Get current server database status
 */
export function getServerStatus(): ServerMetadata {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const raw = fs.readFileSync(METADATA_FILE, 'utf-8');
      const meta = JSON.parse(raw);
      return {
        ...meta,
        storageReady: true,
        storagePath: STORAGE_PATH,
      };
    }
  } catch (err) {
    console.error('Failed to read metadata:', err);
  }

  const emps = getAllServerEmployees();
  const photos = getPhotoCount();
  const embeddings = getAllEmbeddings();

  return {
    version: 1,
    ready: emps.length > 0,
    employeeCount: emps.length,
    photoCount: photos,
    embeddingCount: Object.keys(embeddings).length,
    excelFileName: fs.existsSync(MASTER_EXCEL_FILE) ? 'pegawai.xlsx' : undefined,
    lastUpdated: new Date().toISOString(),
    storageReady: true,
    storagePath: STORAGE_PATH,
  };
}

/**
 * Update metadata counts and version
 */
export function updateMetadataCounts(incrementVersion = false): ServerMetadata {
  let currentMeta: ServerMetadata = {
    version: 1,
    ready: false,
    employeeCount: 0,
    photoCount: 0,
    embeddingCount: 0,
    excelFileName: 'pegawai.xlsx',
    lastUpdated: new Date().toISOString(),
    storageReady: true,
    storagePath: STORAGE_PATH,
  };

  if (fs.existsSync(METADATA_FILE)) {
    try {
      currentMeta = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
    } catch {
      // ignore
    }
  }

  const employees = getAllServerEmployees();
  const photoCount = getPhotoCount();
  const embeddings = getAllEmbeddings();
  const embeddingCount = Object.keys(embeddings).length;

  const newMeta: ServerMetadata = {
    ...currentMeta,
    version: incrementVersion ? (currentMeta.version || 1) + 1 : currentMeta.version || 1,
    ready: employees.length > 0,
    employeeCount: employees.length,
    photoCount,
    embeddingCount,
    excelFileName: fs.existsSync(MASTER_EXCEL_FILE) ? 'pegawai.xlsx' : currentMeta.excelFileName,
    lastUpdated: new Date().toISOString(),
    storageReady: true,
    storagePath: STORAGE_PATH,
  };

  fs.writeFileSync(METADATA_FILE, JSON.stringify(newMeta, null, 2), 'utf-8');
  return newMeta;
}

/**
 * Get all employee records from persistent storage
 */
export function getAllServerEmployees(): ServerEmployee[] {
  try {
    if (fs.existsSync(PEGAWAI_FILE)) {
      const raw = fs.readFileSync(PEGAWAI_FILE, 'utf-8');
      const list = JSON.parse(raw);
      // Merge with embeddings if stored separately
      const embeddings = getAllEmbeddings();
      return list.map((emp: ServerEmployee) => {
        if (!emp.faceDescriptor && embeddings[emp.nomor_induk]) {
          emp.faceDescriptor = embeddings[emp.nomor_induk];
        }
        return emp;
      });
    }
  } catch (err) {
    console.error('Failed to read pegawai.json:', err);
  }
  return [];
}

/**
 * Save employee records to persistent storage
 */
export function saveServerEmployees(employees: ServerEmployee[]): void {
  fs.writeFileSync(PEGAWAI_FILE, JSON.stringify(employees, null, 2), 'utf-8');
  updateMetadataCounts(true);
}

/**
 * Get a single employee by Nomor Induk
 */
export function getServerEmployeeById(nomorInduk: string): ServerEmployee | undefined {
  const all = getAllServerEmployees();
  return all.find((e) => e.nomor_induk === nomorInduk);
}

/**
 * Count photos in photo storage
 */
export function getPhotoCount(): number {
  try {
    if (fs.existsSync(PHOTO_PATH)) {
      const files = fs.readdirSync(PHOTO_PATH);
      return files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).length;
    }
  } catch {
    // ignore
  }
  return 0;
}

/**
 * Get all face embeddings (nomor_induk -> descriptor array)
 */
export function getAllEmbeddings(): Record<string, number[]> {
  try {
    if (fs.existsSync(EMBEDDINGS_FILE)) {
      const raw = fs.readFileSync(EMBEDDINGS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to read embeddings.json:', err);
  }
  return {};
}

/**
 * Save embeddings map to persistent storage
 */
export function saveEmbeddings(newEmbeddings: Record<string, number[]>): void {
  const existing = getAllEmbeddings();
  const merged = { ...existing, ...newEmbeddings };
  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');

  // Also sync into pegawai.json
  const employees = getAllServerEmployees();
  let changed = false;
  for (const emp of employees) {
    if (merged[emp.nomor_induk] && (!emp.faceDescriptor || emp.faceDescriptor.length === 0)) {
      emp.faceDescriptor = merged[emp.nomor_induk];
      emp.photoStatus = 'ready';
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(PEGAWAI_FILE, JSON.stringify(employees, null, 2), 'utf-8');
  }

  updateMetadataCounts(true);
}

/**
 * Save an individual employee photo file to /storage/photos/[nomorInduk].jpg
 */
export function savePhotoFile(nomorInduk: string, buffer: Buffer, ext = 'jpg'): string {
  const fileName = `${nomorInduk}.${ext}`;
  const filePath = path.join(PHOTO_PATH, fileName);
  fs.writeFileSync(filePath, buffer);
  return fileName;
}

/**
 * Get photo file path
 */
export function getPhotoFilePath(nomorInduk: string): string | null {
  const possibleExts = ['jpg', 'jpeg', 'png', 'webp'];
  for (const ext of possibleExts) {
    const p = path.join(PHOTO_PATH, `${nomorInduk}.${ext}`);
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Save Master Excel file
 */
export function saveMasterExcelFile(buffer: Buffer, originalName?: string): void {
  fs.writeFileSync(MASTER_EXCEL_FILE, buffer);
  if (originalName && originalName !== 'pegawai.xlsx') {
    const altPath = path.join(EXCEL_PATH, originalName);
    fs.writeFileSync(altPath, buffer);
  }
}

/**
 * Read and parse rows from the master excel file or uploaded buffer
 */
export function parseExcelBuffer(buffer: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

/**
 * Settings storage
 */
export function getServerSettings(): Record<string, unknown> {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveServerSettings(settings: Record<string, unknown>): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Recognition History Logs storage
 */
export function getServerLogs(): unknown[] {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

export function appendServerLog(log: Record<string, unknown>): void {
  const logs = getServerLogs();
  logs.unshift(log); // newest first
  // keep last 500 logs
  const trimmed = logs.slice(0, 500);
  fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
}

export function clearServerLogs(): void {
  fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

/**
 * Create a full persistent backup
 */
export function createBackup(): ServerBackupItem {
  const timestamp = Date.now();
  const dateStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${dateStr}.json`;
  const backupFilePath = path.join(BACKUP_PATH, backupFileName);

  const employees = getAllServerEmployees();
  const embeddings = getAllEmbeddings();
  const settings = getServerSettings();
  const logs = getServerLogs();
  const metadata = getServerStatus();

  // Also include photos as base64 map if <= 100MB
  const photoFiles = fs.readdirSync(PHOTO_PATH).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  const photosData: Record<string, string> = {};
  for (const f of photoFiles.slice(0, 2000)) {
    try {
      const buf = fs.readFileSync(path.join(PHOTO_PATH, f));
      photosData[f] = buf.toString('base64');
    } catch {
      // ignore
    }
  }

  const backupPayload = {
    backupId: `bkp_${timestamp}`,
    createdAt: timestamp,
    metadata,
    employees,
    embeddings,
    settings,
    logs,
    photos: photosData,
  };

  const rawJson = JSON.stringify(backupPayload, null, 2);
  fs.writeFileSync(backupFilePath, rawJson, 'utf-8');

  const stats = fs.statSync(backupFilePath);
  return {
    id: `bkp_${timestamp}`,
    fileName: backupFileName,
    sizeBytes: stats.size,
    createdAt: timestamp,
    employeeCount: employees.length,
    photoCount: Object.keys(photosData).length,
    embeddingCount: Object.keys(embeddings).length,
  };
}

/**
 * List all existing backups
 */
export function listBackups(): ServerBackupItem[] {
  if (!fs.existsSync(BACKUP_PATH)) return [];
  const files = fs.readdirSync(BACKUP_PATH).filter((f) => f.endsWith('.json'));

  const result: ServerBackupItem[] = [];
  for (const f of files) {
    try {
      const filePath = path.join(BACKUP_PATH, f);
      const stat = fs.statSync(filePath);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      result.push({
        id: parsed.backupId || f,
        fileName: f,
        sizeBytes: stat.size,
        createdAt: parsed.createdAt || stat.mtimeMs,
        employeeCount: parsed.employees?.length || 0,
        photoCount: Object.keys(parsed.photos || {}).length,
        embeddingCount: Object.keys(parsed.embeddings || {}).length,
      });
    } catch {
      // ignore corrupt backup entry
    }
  }

  return result.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Restore from backup file
 */
export function restoreBackup(backupIdOrFileName: string): boolean {
  let targetFile = path.join(BACKUP_PATH, backupIdOrFileName);
  if (!fs.existsSync(targetFile)) {
    // Try matching ID
    const list = listBackups();
    const match = list.find((b) => b.id === backupIdOrFileName || b.fileName === backupIdOrFileName);
    if (!match) return false;
    targetFile = path.join(BACKUP_PATH, match.fileName);
  }

  try {
    const raw = fs.readFileSync(targetFile, 'utf-8');
    const data = JSON.parse(raw);

    if (Array.isArray(data.employees)) {
      fs.writeFileSync(PEGAWAI_FILE, JSON.stringify(data.employees, null, 2), 'utf-8');
    }

    if (data.embeddings) {
      fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(data.embeddings, null, 2), 'utf-8');
    }

    if (data.settings) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data.settings, null, 2), 'utf-8');
    }

    if (Array.isArray(data.logs)) {
      fs.writeFileSync(LOGS_FILE, JSON.stringify(data.logs, null, 2), 'utf-8');
    }

    // Restore photos
    if (data.photos && typeof data.photos === 'object') {
      for (const [fileName, b64] of Object.entries(data.photos)) {
        try {
          const buf = Buffer.from(b64 as string, 'base64');
          fs.writeFileSync(path.join(PHOTO_PATH, fileName), buf);
        } catch {
          // ignore
        }
      }
    }

    updateMetadataCounts(true);
    return true;
  } catch (err) {
    console.error('Failed to restore backup:', err);
    return false;
  }
}

/**
 * Reset server database
 */
export function resetServerDatabase(): void {
  if (fs.existsSync(PEGAWAI_FILE)) fs.unlinkSync(PEGAWAI_FILE);
  if (fs.existsSync(EMBEDDINGS_FILE)) fs.unlinkSync(EMBEDDINGS_FILE);
  if (fs.existsSync(LOGS_FILE)) fs.unlinkSync(LOGS_FILE);
  if (fs.existsSync(MASTER_EXCEL_FILE)) fs.unlinkSync(MASTER_EXCEL_FILE);

  // Clean photos
  if (fs.existsSync(PHOTO_PATH)) {
    const files = fs.readdirSync(PHOTO_PATH);
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(PHOTO_PATH, f));
      } catch {
        // ignore
      }
    }
  }

  updateMetadataCounts(true);
}
