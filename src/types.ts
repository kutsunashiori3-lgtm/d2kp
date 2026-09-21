/**
 * Type definitions for Employee Face Recognition System
 */

export interface Employee {
  nomor_induk: string; // Primary key (strictly string, normalized)
  nama: string;
  nip?: string;
  jabatan?: string;
  pangkat_golongan?: string;
  unit_kerja?: string;
  instansi?: string;
  extraFields?: Record<string, string>;
  hasPhoto: boolean;
  photoFileName?: string;
  photoUrl?: string; // Data URL or object URL thumbnail
  faceDescriptor?: number[]; // 128-d vector embedding
  photoStatus: 'ready' | 'no_face' | 'multi_face' | 'error' | 'no_photo';
  photoError?: string;
  updatedAt: number;
}

export interface PhotoRecord {
  nomor_induk: string;
  fileName: string;
  fileBlob?: Blob;
  dataUrl?: string;
  descriptor?: number[];
  status: 'ready' | 'no_face' | 'multi_face' | 'error';
  errorMessage?: string;
  faceCount?: number;
}

export interface ExcelColumnMapping {
  nomor_induk: string;
  nama: string;
  nip?: string;
  jabatan?: string;
  pangkat_golongan?: string;
  unit_kerja?: string;
  instansi?: string;
}

export interface RecognitionLog {
  id: string;
  timestamp: number;
  dateStr: string; // DD-MM-YYYY
  timeStr: string; // HH:mm:ss
  nomor_induk: string;
  nama: string;
  nip?: string;
  jabatan?: string;
  unit_kerja: string;
  instansi?: string;
  confidence: number; // percentage 0 - 100%
  distance: number; // Euclidean distance (0.0 - 1.0+)
  status: 'Recognized' | 'Unrecognized';
  photoUrl?: string;
  sourceType?: 'Realtime Camera' | 'Manual Photo';
}

export interface DatabaseStats {
  totalExcel: number;
  totalPhotos: number;
  connected: number;
  photoNotFoundInExcel: number;
  excelWithoutPhoto: number;
  photoFailed: number;
  embeddingReady: number;
}

export interface AppSettings {
  matchThreshold: number; // 0.40 - 0.60, default 0.50 (lower = stricter)
  detectorType: 'ssdMobilenetv1' | 'tinyFaceDetector';
  confirmationFrames: number; // default 3 out of 5
  detectionIntervalMs: number; // default 200ms
  selectedCameraId: string;
  enableAntiSpoofing: boolean;
  beepOnRecognize: boolean;
  cooldownPeriodSeconds: number; // Prevent duplicate logs for same person within X seconds
}

export interface DetectedFaceResult {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  descriptor: Float32Array;
  employee?: Employee;
  confidence?: number;
  distance?: number;
  isRecognized: boolean;
  consecutiveMatches?: number;
  isConfirmed?: boolean;
  livenessPassed?: boolean;
}

export interface ServerDatabaseStatus {
  ready: boolean;
  version: number;
  employeeCount: number;
  photoCount: number;
  embeddingCount: number;
  excelFileName?: string;
  lastUpdated: string;
  storageReady: boolean;
  storagePath?: string;
}

export interface ServerBackupInfo {
  id: string;
  fileName: string;
  sizeBytes: number;
  createdAt: number;
  employeeCount: number;
  photoCount: number;
  embeddingCount: number;
}
