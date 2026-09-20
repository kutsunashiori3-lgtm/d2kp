/**
 * Folder Photo Importer component.
 * Reads photo files from folder (webkitdirectory) or multi-file picker,
 * extracts Nomor Induk from filename, computes face embeddings locally,
 * and saves into IndexedDB.
 */
import React, { useState, useRef } from 'react';
import { Employee } from '../types';
import { isImageFile } from '../utils/fileValidator';
import { extractIdFromFilename } from '../utils/normalizeEmployeeId';
import { fileToImage } from '../services/imageProcessor';
import { processEmployeePhoto } from '../services/faceRecognition';
import { getAllEmployees, saveEmployees } from '../services/database';
import { uploadPhotosToServer } from '../services/serverDbService';
import {
  FolderOpen,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';

interface FolderImporterProps {
  onSuccess: (processedCount: number) => void;
}

interface ProcessLogItem {
  fileName: string;
  nomorInduk: string;
  status: 'ready' | 'no_face' | 'multi_face' | 'error';
  message: string;
  hasExcelMatch: boolean;
  thumbnailUrl?: string;
}

export const FolderImporter: React.FC<FolderImporterProps> = ({ onSuccess }) => {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentProgress, setCurrentProgress] = useState<{
    current: number;
    total: number;
    currentName: string;
  }>({ current: 0, total: 0, currentName: '' });

  const [logs, setLogs] = useState<ProcessLogItem[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    success: number;
    warnings: number;
    errors: number;
    excelMatched: number;
    excelUnmatched: number;
  } | null>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    // Filter supported image files
    const imageFiles = rawFiles.filter(isImageFile);

    if (imageFiles.length === 0) {
      alert('Tidak ditemukan berkas gambar yang didukung (.jpg, .jpeg, .png, .webp) pada folder yang dipilih.');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setSummary(null);
    setCurrentProgress({ current: 0, total: imageFiles.length, currentName: '' });

    // Load existing employees from database
    const existingEmployees = await getAllEmployees();
    const employeeMap = new Map<string, Employee>();
    existingEmployees.forEach((emp) => employeeMap.set(emp.nomor_induk, emp));

    const updatedEmployees: Employee[] = [];
    const localLogs: ProcessLogItem[] = [];

    let successCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const nomorInduk = extractIdFromFilename(file.name);

      setCurrentProgress({
        current: i + 1,
        total: imageFiles.length,
        currentName: file.name,
      });

      try {
        // 1. Load image to HTMLImageElement
        const imgElement = await fileToImage(file);

        // 2. Detect face & generate 128-d descriptor
        const result = await processEmployeePhoto(imgElement);

        const hasExcelMatch = employeeMap.has(nomorInduk);
        if (hasExcelMatch) {
          matchedCount++;
        } else {
          unmatchedCount++;
        }

        if (result.status === 'ready') {
          successCount++;
        } else if (result.status === 'multi_face') {
          warningCount++;
        } else {
          errorCount++;
        }

        const logItem: ProcessLogItem = {
          fileName: file.name,
          nomorInduk,
          status: result.status,
          message: result.errorMessage || 'Wajah terdeteksi dan embedding berhasil dibuat.',
          hasExcelMatch,
          thumbnailUrl: result.thumbnailUrl,
        };
        localLogs.push(logItem);

        // Update or create employee record
        const existing = employeeMap.get(nomorInduk);
        if (existing) {
          updatedEmployees.push({
            ...existing,
            hasPhoto: true,
            photoFileName: file.name,
            photoUrl: result.thumbnailUrl,
            faceDescriptor: result.descriptor,
            photoStatus: result.status,
            photoError: result.errorMessage,
            updatedAt: Date.now(),
          });
        } else {
          // Photo without Excel data (photo only record)
          updatedEmployees.push({
            nomor_induk: nomorInduk,
            nama: `Pegawai ${nomorInduk}`,
            nip: nomorInduk,
            jabatan: '-',
            pangkat_golongan: '-',
            unit_kerja: 'Data Excel Belum Diimpor',
            instansi: '-',
            hasPhoto: true,
            photoFileName: file.name,
            photoUrl: result.thumbnailUrl,
            faceDescriptor: result.descriptor,
            photoStatus: result.status,
            photoError: result.errorMessage,
            extraFields: { _isPhotoOnly: 'true' },
            updatedAt: Date.now(),
          });
        }
      } catch (err: unknown) {
        errorCount++;
        localLogs.push({
          fileName: file.name,
          nomorInduk,
          status: 'error',
          message: err instanceof Error ? err.message : 'Gagal memproses foto.',
          hasExcelMatch: employeeMap.has(nomorInduk),
        });
      }
    }

    // Save all updated employees to IndexedDB
    await saveEmployees(updatedEmployees);

    // Save photos and embeddings to Master Server storage
    try {
      const photosToUpload = updatedEmployees
        .filter((emp) => emp.hasPhoto && emp.photoUrl)
        .map((emp) => ({
          nomorInduk: emp.nomor_induk,
          fileName: emp.photoFileName || `${emp.nomor_induk}.jpg`,
          base64: emp.photoUrl,
          descriptor: emp.faceDescriptor,
        }));

      if (photosToUpload.length > 0) {
        await uploadPhotosToServer(photosToUpload);
      }
    } catch (sErr) {
      console.warn('Failed to upload photos to master server:', sErr);
    }

    setLogs(localLogs);
    setSummary({
      total: imageFiles.length,
      success: successCount,
      warnings: warningCount,
      errors: errorCount,
      excelMatched: matchedCount,
      excelUnmatched: unmatchedCount,
    });
    setIsProcessing(false);
    onSuccess(updatedEmployees.length);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-blue-600" />
          Import Database Foto Pegawai
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Pilih folder berisi foto wajah pegawai. Nama berkas foto otomatis dijadikan <strong>Nomor Induk</strong> (contoh: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-semibold">198701012010011001.jpg</code>).
        </p>
      </div>

      {/* Hidden Inputs */}
      {/* 1. Directory picker */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in all modern browsers
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
          }
        }}
      />

      {/* 2. Multi-file picker fallback */}
      <input
        ref={multiFileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
          }
        }}
      />

      {/* Folder Select Action Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Button: Select Entire Folder */}
        <div
          onClick={() => !isProcessing && folderInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isProcessing
              ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
              : 'border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/80'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mx-auto mb-3">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Pilih Folder Foto (Rekomendasi)</h3>
          <p className="text-xs text-slate-500 mt-1">
            Membaca seluruh folder foto pegawai sekaligus secara otomatis.
          </p>
        </div>

        {/* Button: Select Multiple Files */}
        <div
          onClick={() => !isProcessing && multiFileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isProcessing
              ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-100/70'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center mx-auto mb-3">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Pilih Berkas Foto Sekaligus</h3>
          <p className="text-xs text-slate-500 mt-1">
            Jika browser tidak mendukung pemilihan folder, pilih beberapa file foto (.jpg, .png).
          </p>
        </div>
      </div>

      {/* Processing Progress Bar */}
      {isProcessing && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-bold text-blue-900 mb-2">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              Mendeteksi Wajah & Menghasilkan Face Embedding...
            </span>
            <span className="font-mono">
              {currentProgress.current} / {currentProgress.total} (
              {Math.round((currentProgress.current / currentProgress.total) * 100)}%)
            </span>
          </div>

          <div className="w-full h-2.5 bg-blue-200 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-150"
              style={{
                width: `${(currentProgress.current / currentProgress.total) * 100}%`,
              }}
            />
          </div>

          <p className="text-xs text-blue-700 truncate font-mono">
            Sedang memproses: {currentProgress.currentName}
          </p>
        </div>
      )}

      {/* Summary Box */}
      {summary && !isProcessing && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Hasil Pre-processing Database Foto:
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
              <span className="text-[11px] text-slate-500 block font-medium">Total Foto</span>
              <span className="text-lg font-bold text-slate-900">{summary.total}</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
              <span className="text-[11px] text-emerald-700 block font-medium">Berhasil</span>
              <span className="text-lg font-bold text-emerald-800">{summary.success}</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
              <span className="text-[11px] text-amber-700 block font-medium">Multi-Wajah</span>
              <span className="text-lg font-bold text-amber-800">{summary.warnings}</span>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-center">
              <span className="text-[11px] text-rose-700 block font-medium">Gagal / No Face</span>
              <span className="text-lg font-bold text-rose-800">{summary.errors}</span>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-center">
              <span className="text-[11px] text-blue-700 block font-medium">Cocok di Excel</span>
              <span className="text-lg font-bold text-blue-800">{summary.excelMatched}</span>
            </div>

            <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-center">
              <span className="text-[11px] text-purple-700 block font-medium">Belum Ada di Excel</span>
              <span className="text-lg font-bold text-purple-800">{summary.excelUnmatched}</span>
            </div>
          </div>

          {/* Diagnostic Log Table */}
          <div className="mt-5">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Rincian Pemrosesan per Foto ({logs.length}):
            </h4>
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Foto</th>
                    <th className="py-2 px-3">Nama Berkas</th>
                    <th className="py-2 px-3">Nomor Induk</th>
                    <th className="py-2 px-3">Status Wajah</th>
                    <th className="py-2 px-3">Koneksi Excel</th>
                    <th className="py-2 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.nomorInduk}
                            className="w-8 h-8 rounded object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-3 font-mono font-medium text-slate-800">
                        {item.fileName}
                      </td>
                      <td className="py-1.5 px-3 font-mono font-semibold text-blue-700">
                        {item.nomorInduk}
                      </td>
                      <td className="py-1.5 px-3">
                        {item.status === 'ready' && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 1 Wajah
                          </span>
                        )}
                        {item.status === 'multi_face' && (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" /> Multi Wajah
                          </span>
                        )}
                        {(item.status === 'no_face' || item.status === 'error') && (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                            <XCircle className="w-3.5 h-3.5" /> Gagal
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3">
                        {item.hasExcelMatch ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                            Terhubung
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">
                            Tidak di Excel
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 max-w-xs truncate">
                        {item.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
