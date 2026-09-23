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

// Safe XLSX helper for both ESM and CJS bundlers
function getXLSX(): any {
  if (typeof (XLSX as any).read === 'function') {
    return XLSX;
  }
  if ((XLSX as any).default && typeof (XLSX as any).default.read === 'function') {
    return (XLSX as any).default;
  }
  return XLSX;
}

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
const MASTER_EXCEL_FILE = path.join(EXCEL_PATH, 'master_pegawai.xlsx');
export const SYNC_LOG_FILE = path.join(LOG_PATH, 'sync.log');
export const FILE_TRACKING_FILE = path.join(DATABASE_PATH, 'file_tracking.json');

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
  photoStatus: 'ready' | 'no_face' | 'multi_face' | 'low_quality' | 'error' | 'no_photo' | 'pending';
  photoError?: string;
  updatedAt: number;
}

export interface PhotoTrackInfo {
  nomorInduk: string;
  fileName: string;
  mtime: number;
  size: number;
  status: 'ready' | 'no_face' | 'multi_face' | 'low_quality' | 'error' | 'pending';
  hasEmbedding: boolean;
  lastProcessed: number;
  error?: string;
}

export interface ExcelTrackInfo {
  fileName: string;
  mtime: number;
  size: number;
  lastProcessed: number;
  rowCount: number;
}

export interface FileTrackingData {
  excel: ExcelTrackInfo | null;
  photos: Record<string, PhotoTrackInfo>;
}

export interface ServerSyncResult {
  success: boolean;
  message: string;
  excelFileName: string | null;
  excelProcessed: boolean;
  totalEmployees: number;
  totalPhotos: number;
  totalEmbeddings: number;
  newPhotosCount: number;
  updatedPhotosCount: number;
  missingPhotosCount: number;
  unmatchedPhotosCount: number;
  deletedPhotosCount: number;
  pendingPhotos: Array<{
    nomorInduk: string;
    fileName: string;
    photoUrl: string;
    reason: 'new' | 'modified';
  }>;
  syncTime: string;
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
 * Get current server database status with live accurate counts from storage
 */
export function getServerStatus(): ServerMetadata {
  return updateMetadataCounts(false);
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
 * Save embeddings map to persistent storage and sync with employee records
 */
export function saveEmbeddings(newEmbeddings: Record<string, number[]>): void {
  const existing = getAllEmbeddings();
  const merged = { ...existing, ...newEmbeddings };
  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');

  // Also sync into pegawai.json
  const employees = getAllServerEmployees();
  const empMap = new Map<string, ServerEmployee>();
  employees.forEach((e) => empMap.set(e.nomor_induk, e));

  let changed = false;

  for (const [id, descriptor] of Object.entries(merged)) {
    if (!id || !Array.isArray(descriptor) || descriptor.length === 0) continue;
    const existingEmp = empMap.get(id);
    if (existingEmp) {
      existingEmp.faceDescriptor = descriptor;
      existingEmp.photoStatus = 'ready';
      existingEmp.hasPhoto = true;
      if (!existingEmp.photoUrl) {
        existingEmp.photoUrl = `/api/photos/${id}`;
      }
      if (!existingEmp.photoFileName) {
        existingEmp.photoFileName = `${id}.jpg`;
      }
      existingEmp.updatedAt = Date.now();
      changed = true;
    } else {
      // Photo and embedding exists, create employee entry
      const newEmp: ServerEmployee = {
        nomor_induk: id,
        nama: `Pegawai ${id}`,
        nip: id,
        jabatan: '-',
        pangkat_golongan: '-',
        unit_kerja: 'Data Excel Belum Diimpor',
        instansi: '-',
        hasPhoto: true,
        photoFileName: `${id}.jpg`,
        photoUrl: `/api/photos/${id}`,
        faceDescriptor: descriptor,
        photoStatus: 'ready',
        extraFields: { _isPhotoOnly: 'true' },
        updatedAt: Date.now(),
      };
      empMap.set(id, newEmp);
      changed = true;
    }
  }

  if (changed) {
    const updatedEmployees = Array.from(empMap.values());
    fs.writeFileSync(PEGAWAI_FILE, JSON.stringify(updatedEmployees, null, 2), 'utf-8');
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
  updateMetadataCounts(false);
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

/**
 * Append entry to /storage/logs/sync.log
 */
export function appendSyncLog(message: string): void {
  try {
    const timestamp = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const logLine = `[${timestamp} WIB] ${message}\n`;
    fs.appendFileSync(SYNC_LOG_FILE, logLine, 'utf-8');
  } catch (err) {
    console.error('Failed to append to sync.log:', err);
  }
}

/**
 * Read the latest lines from /storage/logs/sync.log
 */
export function getSyncLogContent(maxLines = 150): string {
  try {
    if (!fs.existsSync(SYNC_LOG_FILE)) {
      return 'Belum ada catatan log sinkronisasi.';
    }
    const content = fs.readFileSync(SYNC_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    return lines.slice(-maxLines).join('\n');
  } catch {
    return 'Gagal membaca file sync.log.';
  }
}

/**
 * Load file tracking cache from /storage/database/file_tracking.json
 */
export function loadFileTracking(): FileTrackingData {
  try {
    if (fs.existsSync(FILE_TRACKING_FILE)) {
      const raw = fs.readFileSync(FILE_TRACKING_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return {
    excel: null,
    photos: {},
  };
}

/**
 * Save file tracking cache to /storage/database/file_tracking.json
 */
export function saveFileTracking(data: FileTrackingData): void {
  try {
    fs.writeFileSync(FILE_TRACKING_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save file tracking:', err);
  }
}

/**
 * Automatically export existing employees to /storage/excel/master_pegawai.xlsx
 * if no excel file exists yet.
 */
export function ensureMasterExcelFile(): string | null {
  try {
    if (!fs.existsSync(EXCEL_PATH)) {
      fs.mkdirSync(EXCEL_PATH, { recursive: true });
    }

    const existingFiles = fs.readdirSync(EXCEL_PATH).filter(
      (f) => (f.endsWith('.xlsx') || f.endsWith('.xls')) && !f.startsWith('~$')
    );

    if (existingFiles.length > 0) {
      const preferred = existingFiles.find((f) => f.toLowerCase() === 'master_pegawai.xlsx') || existingFiles[0];
      return preferred;
    }

    const employees = getAllServerEmployees();
    if (employees.length === 0) {
      return null;
    }

    const rows = employees.map((emp) => {
      const row: Record<string, unknown> = {
        'NOMOR INDUK': emp.nomor_induk,
        NIP: emp.nip || emp.nomor_induk,
        'NAMA LENGKAP': emp.nama,
        JABATAN: emp.jabatan || '-',
        'PANGKAT / GOLONGAN': emp.pangkat_golongan || '-',
        'UNIT KERJA': emp.unit_kerja || '-',
        INSTANSI: emp.instansi || 'Pemerintah Kabupaten',
      };
      if (emp.extraFields) {
        for (const [k, v] of Object.entries(emp.extraFields)) {
          row[k] = v;
        }
      }
      return row;
    });

    const xlsx = getXLSX();
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(wb, ws, 'DATA PEGAWAI');
    const targetFile = path.join(EXCEL_PATH, 'master_pegawai.xlsx');
    const outBuf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(targetFile, outBuf);

    appendSyncLog(`[INISIALISASI EXCEL] Dibuat file master_pegawai.xlsx otomatis (${employees.length} pegawai).`);
    return 'master_pegawai.xlsx';
  } catch (err) {
    console.error('Failed to ensure master excel file:', err);
    return null;
  }
}

/**
 * Scan server folders (/storage/excel/ and /storage/photos/) and synchronize with database
 */
export async function scanAndSyncServerFiles(): Promise<ServerSyncResult> {
  const syncStartTime = new Date().toISOString();
  appendSyncLog('[SINKRONISASI DIMULAI] Memeriksa folder /storage/excel/ dan /storage/photos/...');

  const tracking = loadFileTracking();
  let employees = getAllServerEmployees();
  const existingEmbeddings = getAllEmbeddings();

  // ==========================================
  // 1. Scan and process /storage/excel/
  // ==========================================
  ensureMasterExcelFile();
  let excelFileName: string | null = null;
  let excelProcessed = false;

  try {
    const excelFiles = fs.readdirSync(EXCEL_PATH).filter(
      (f) => (f.endsWith('.xlsx') || f.endsWith('.xls')) && !f.startsWith('~$')
    );

    if (excelFiles.length > 0) {
      // Prioritize master_pegawai.xlsx, or latest modified
      const sorted = excelFiles.sort((a, b) => {
        if (a.toLowerCase() === 'master_pegawai.xlsx') return -1;
        if (b.toLowerCase() === 'master_pegawai.xlsx') return 1;
        const statA = fs.statSync(path.join(EXCEL_PATH, a));
        const statB = fs.statSync(path.join(EXCEL_PATH, b));
        return statB.mtimeMs - statA.mtimeMs;
      });

      excelFileName = sorted[0];
      const excelFilePath = path.join(EXCEL_PATH, excelFileName);
      const stat = fs.statSync(excelFilePath);

      const needsExcelParse =
        !tracking.excel ||
        tracking.excel.fileName !== excelFileName ||
        tracking.excel.mtime !== stat.mtimeMs ||
        tracking.excel.size !== stat.size;

      if (needsExcelParse) {
        appendSyncLog(`[MEMBACA EXCEL] Mendeteksi file ${excelFileName} (diubah: ${new Date(stat.mtimeMs).toLocaleString('id-ID')})...`);
        const xlsx = getXLSX();
        const fileBuffer = fs.readFileSync(excelFilePath);
        const wb = xlsx.read(fileBuffer, { type: 'buffer' });
        const firstSheetName = wb.SheetNames[0];
        if (firstSheetName) {
          const ws = wb.Sheets[firstSheetName];
          const rawRows = xlsx.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];

          if (rawRows.length > 0) {
            const empMap = new Map<string, ServerEmployee>();
            employees.forEach((e) => empMap.set(e.nomor_induk, e));

            let updatedCount = 0;
            let insertedCount = 0;

            for (const row of rawRows) {
              const keys = Object.keys(row);
              if (keys.length === 0) continue;

              // Dynamic column detection
              let idKey = keys.find((k) => /nomor\s*induk|no\.?\s*induk|id_pegawai|nik|nip/i.test(k));
              if (!idKey) idKey = keys[0];

              const nameKey = keys.find((k) => /^(nama|nama\s*lengkap|name)$/i.test(k));
              const nipKey = keys.find((k) => /^nip$/i.test(k));
              const jabatanKey = keys.find((k) => /jabatan|posisi|position/i.test(k));
              const pangkatKey = keys.find((k) => /pangkat|golongan|pangkat\s*\/?\s*gol/i.test(k));
              const unitKey = keys.find((k) => /unit|unit\s*kerja|bidang|divisi|bagian/i.test(k));
              const instansiKey = keys.find((k) => /instansi|organisasi|perusahaan/i.test(k));

              const rawId = String(row[idKey] ?? '').trim();
              if (!rawId) continue;

              const rawName = nameKey ? String(row[nameKey] ?? '').trim() : `Pegawai ${rawId}`;
              const nipVal = nipKey ? String(row[nipKey] ?? '').trim() : undefined;
              const jabatanVal = jabatanKey ? String(row[jabatanKey] ?? '').trim() : undefined;
              const pangkatVal = pangkatKey ? String(row[pangkatKey] ?? '').trim() : undefined;
              const unitVal = unitKey ? String(row[unitKey] ?? '').trim() : undefined;
              const instansiVal = instansiKey ? String(row[instansiKey] ?? '').trim() : undefined;

              const standardKeys = new Set([idKey, nameKey, nipKey, jabatanKey, pangkatKey, unitKey, instansiKey].filter(Boolean));
              const extraFields: Record<string, string> = {};
              for (const [k, v] of Object.entries(row)) {
                if (!standardKeys.has(k) && String(v).trim()) {
                  extraFields[k] = String(v).trim();
                }
              }

              const existingEmp = empMap.get(rawId);
              if (existingEmp) {
                empMap.set(rawId, {
                  ...existingEmp,
                  nama: rawName || existingEmp.nama,
                  nip: nipVal || existingEmp.nip,
                  jabatan: jabatanVal || existingEmp.jabatan,
                  pangkat_golongan: pangkatVal || existingEmp.pangkat_golongan,
                  unit_kerja: unitVal || existingEmp.unit_kerja,
                  instansi: instansiVal || existingEmp.instansi,
                  extraFields: { ...(existingEmp.extraFields || {}), ...extraFields },
                  updatedAt: Date.now(),
                });
                updatedCount++;
              } else {
                empMap.set(rawId, {
                  nomor_induk: rawId,
                  nama: rawName,
                  nip: nipVal,
                  jabatan: jabatanVal,
                  pangkat_golongan: pangkatVal,
                  unit_kerja: unitVal,
                  instansi: instansiVal,
                  extraFields,
                  hasPhoto: false,
                  photoStatus: 'no_photo',
                  updatedAt: Date.now(),
                });
                insertedCount++;
              }
            }

            employees = Array.from(empMap.values());
            saveServerEmployees(employees);

            tracking.excel = {
              fileName: excelFileName,
              mtime: stat.mtimeMs,
              size: stat.size,
              lastProcessed: Date.now(),
              rowCount: rawRows.length,
            };
            excelProcessed = true;
            appendSyncLog(`[EXCEL SELESAI] ${excelFileName}: ${rawRows.length} baris diproses (${updatedCount} diperbarui, ${insertedCount} baru).`);
          }
        }
      }
    }
  } catch (err) {
    appendSyncLog(`[ERROR EXCEL] Gagal memproses file Excel: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ==========================================
  // 2. Scan and process /storage/photos/
  // ==========================================
  let newPhotosCount = 0;
  let updatedPhotosCount = 0;
  let deletedPhotosCount = 0;
  let missingPhotosCount = 0;
  let unmatchedPhotosCount = 0;

  const pendingPhotos: Array<{
    nomorInduk: string;
    fileName: string;
    photoUrl: string;
    reason: 'new' | 'modified';
  }> = [];

  const empMap = new Map<string, ServerEmployee>();
  employees.forEach((e) => empMap.set(e.nomor_induk, e));

  const validPhotoExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  const photoFilesOnDisk = fs.readdirSync(PHOTO_PATH).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return validPhotoExts.has(ext);
  });

  const photoDiskSet = new Set(photoFilesOnDisk);

  for (const fileName of photoFilesOnDisk) {
    const parsed = path.parse(fileName);
    const nomorInduk = parsed.name.trim();
    const filePath = path.join(PHOTO_PATH, fileName);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }

    const prevTrack = tracking.photos[fileName];
    const hasExistingEmbedding = Boolean(existingEmbeddings[nomorInduk] && existingEmbeddings[nomorInduk].length > 0);

    if (!prevTrack) {
      if (hasExistingEmbedding) {
        // Photo already has an embedding from persistent storage; mark ready without recomputation!
        tracking.photos[fileName] = {
          nomorInduk,
          fileName,
          mtime: stat.mtimeMs,
          size: stat.size,
          status: 'ready',
          hasEmbedding: true,
          lastProcessed: Date.now(),
        };
      } else {
        // Brand new photo needing face detection & descriptor generation
        newPhotosCount++;
        tracking.photos[fileName] = {
          nomorInduk,
          fileName,
          mtime: stat.mtimeMs,
          size: stat.size,
          status: 'pending',
          hasEmbedding: false,
          lastProcessed: Date.now(),
        };
        pendingPhotos.push({
          nomorInduk,
          fileName,
          photoUrl: `/api/photos/${nomorInduk}`,
          reason: 'new',
        });
      }
    } else if (prevTrack.mtime !== stat.mtimeMs || prevTrack.size !== stat.size) {
      // Photo file was replaced or modified!
      updatedPhotosCount++;
      delete existingEmbeddings[nomorInduk];
      tracking.photos[fileName] = {
        nomorInduk,
        fileName,
        mtime: stat.mtimeMs,
        size: stat.size,
        status: 'pending',
        hasEmbedding: false,
        lastProcessed: Date.now(),
      };
      pendingPhotos.push({
        nomorInduk,
        fileName,
        photoUrl: `/api/photos/${nomorInduk}`,
        reason: 'modified',
      });
      appendSyncLog(`[FOTO DIPERBARUI] File ${fileName} (${nomorInduk}) telah diganti di folder server.`);
    } else if (!prevTrack.hasEmbedding && !hasExistingEmbedding && prevTrack.status === 'pending') {
      // Photo still pending embedding
      pendingPhotos.push({
        nomorInduk,
        fileName,
        photoUrl: `/api/photos/${nomorInduk}`,
        reason: 'new',
      });
    }

    // Match with employee record
    const emp = empMap.get(nomorInduk);
    if (emp) {
      emp.hasPhoto = true;
      emp.photoFileName = fileName;
      emp.photoUrl = `/api/photos/${nomorInduk}`;
      if (emp.photoStatus === 'no_photo') {
        emp.photoStatus = hasExistingEmbedding ? 'ready' : 'pending';
      }
    } else {
      // Photo exists on server, but not yet present in Excel!
      unmatchedPhotosCount++;
      const placeholder: ServerEmployee = {
        nomor_induk: nomorInduk,
        nama: `Pegawai ${nomorInduk}`,
        unit_kerja: 'Data Excel Belum Diimpor',
        hasPhoto: true,
        photoFileName: fileName,
        photoUrl: `/api/photos/${nomorInduk}`,
        photoStatus: hasExistingEmbedding ? 'ready' : 'pending',
        updatedAt: Date.now(),
      };
      empMap.set(nomorInduk, placeholder);
      employees.push(placeholder);
    }
  }

  // Detect deleted photos from /storage/photos/
  for (const [trackedFile, info] of Object.entries(tracking.photos)) {
    if (!photoDiskSet.has(trackedFile)) {
      deletedPhotosCount++;
      delete existingEmbeddings[info.nomorInduk];
      const emp = empMap.get(info.nomorInduk);
      if (emp) {
        emp.hasPhoto = false;
        emp.photoFileName = undefined;
        emp.photoUrl = undefined;
        emp.photoStatus = 'no_photo';
        emp.faceDescriptor = undefined;
        emp.updatedAt = Date.now();
      }
      delete tracking.photos[trackedFile];
      appendSyncLog(`[FOTO DIHAPUS] Foto ${trackedFile} (${info.nomorInduk}) dihapus dari server.`);
    }
  }

  // Count employees missing photos
  for (const emp of employees) {
    if (!emp.hasPhoto) {
      missingPhotosCount++;
    }
  }

  // Persist merged employees, tracking, and embeddings
  saveServerEmployees(employees);
  saveEmbeddings(existingEmbeddings);
  saveFileTracking(tracking);
  const status = updateMetadataCounts(true);

  appendSyncLog(
    `[SINKRONISASI SELESAI] Pegawai: ${employees.length}, Foto: ${photoFilesOnDisk.length}, Embedding Siap: ${status.embeddingCount}, Baru: ${newPhotosCount}, Diperbarui: ${updatedPhotosCount}, Dihapus: ${deletedPhotosCount}, Pending Embedding: ${pendingPhotos.length}.`
  );

  return {
    success: true,
    message: 'Sinkronisasi folder server berhasil dijalankan.',
    excelFileName,
    excelProcessed,
    totalEmployees: employees.length,
    totalPhotos: photoFilesOnDisk.length,
    totalEmbeddings: status.embeddingCount,
    newPhotosCount,
    updatedPhotosCount,
    missingPhotosCount,
    unmatchedPhotosCount,
    deletedPhotosCount,
    pendingPhotos,
    syncTime: syncStartTime,
  };
}

/**
 * Apply generated embeddings from face recognition to server database
 */
export async function applyEmbeddingResults(
  results: Array<{
    nomorInduk: string;
    descriptor?: number[];
    status: 'ready' | 'no_face' | 'multi_face' | 'low_quality' | 'error';
    error?: string;
  }>
): Promise<ServerSyncResult> {
  const tracking = loadFileTracking();
  const employees = getAllServerEmployees();
  const empMap = new Map<string, ServerEmployee>();
  employees.forEach((e) => empMap.set(e.nomor_induk, e));
  const embeddings = getAllEmbeddings();

  let successCount = 0;
  let failedCount = 0;

  for (const res of results) {
    const nomorInduk = String(res.nomorInduk).trim();
    if (!nomorInduk) continue;

    const emp = empMap.get(nomorInduk);

    const photoFileName = getPhotoFilePath(nomorInduk);
    const baseName = photoFileName ? path.basename(photoFileName) : `${nomorInduk}.jpg`;

    if (Array.isArray(res.descriptor) && res.descriptor.length > 0 && res.status === 'ready') {
      embeddings[nomorInduk] = res.descriptor;
      if (emp) {
        emp.faceDescriptor = res.descriptor;
        emp.photoStatus = 'ready';
        emp.photoError = undefined;
        emp.updatedAt = Date.now();
      }
      tracking.photos[baseName] = {
        nomorInduk,
        fileName: baseName,
        mtime: fs.existsSync(photoFileName || '') ? fs.statSync(photoFileName || '').mtimeMs : Date.now(),
        size: fs.existsSync(photoFileName || '') ? fs.statSync(photoFileName || '').size : 0,
        status: 'ready',
        hasEmbedding: true,
        lastProcessed: Date.now(),
      };
      successCount++;
    } else {
      delete embeddings[nomorInduk];
      if (emp) {
        emp.photoStatus = res.status;
        emp.photoError = res.error;
        emp.faceDescriptor = undefined;
        emp.updatedAt = Date.now();
      }
      tracking.photos[baseName] = {
        nomorInduk,
        fileName: baseName,
        mtime: fs.existsSync(photoFileName || '') ? fs.statSync(photoFileName || '').mtimeMs : Date.now(),
        size: fs.existsSync(photoFileName || '') ? fs.statSync(photoFileName || '').size : 0,
        status: res.status,
        hasEmbedding: false,
        lastProcessed: Date.now(),
        error: res.error,
      };
      failedCount++;
      appendSyncLog(`[VALIDASI FOTO GAGAL] Nomor Induk ${nomorInduk}: ${res.status} (${res.error || 'Wajah tidak memenuhi syarat'})`);
    }
  }

  saveServerEmployees(employees);
  saveEmbeddings(embeddings);
  saveFileTracking(tracking);
  const status = updateMetadataCounts(true);

  appendSyncLog(`[EMBEDDING SELESAI] Diproses ${results.length} foto (${successCount} berhasil, ${failedCount} gagal/invalid). Total embedding aktif: ${status.embeddingCount}.`);

  return {
    success: true,
    message: `Berhasil memproses embedding ${results.length} foto.`,
    excelFileName: status.excelFileName || 'master_pegawai.xlsx',
    excelProcessed: false,
    totalEmployees: employees.length,
    totalPhotos: status.photoCount,
    totalEmbeddings: status.embeddingCount,
    newPhotosCount: 0,
    updatedPhotosCount: 0,
    missingPhotosCount: employees.filter((e) => !e.hasPhoto).length,
    unmatchedPhotosCount: 0,
    deletedPhotosCount: 0,
    pendingPhotos: [],
    syncTime: new Date().toISOString(),
  };
}
