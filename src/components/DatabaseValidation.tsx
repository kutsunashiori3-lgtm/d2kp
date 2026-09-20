/**
 * Database Validation Page (Tahap 4)
 * Explicitly validates and diagnoses the relation:
 * Nama file foto -> Nomor Induk -> Data Excel.
 */
import React, { useState, useMemo, useRef } from 'react';
import { Employee, DatabaseStats } from '../types';
import { upsertEmployee, deleteEmployee } from '../services/database';
import { fileToImage } from '../services/imageProcessor';
import { processEmployeePhoto } from '../services/faceRecognition';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Upload,
  ArrowRight,
  FileSpreadsheet,
  FolderOpen,
  RefreshCw,
  Info,
  User,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';

interface DatabaseValidationProps {
  employees: Employee[];
  stats: DatabaseStats;
  onRefreshData: () => void;
  onNavigate: (tab: 'import_excel' | 'import_folder' | 'camera' | 'database') => void;
}

type FilterStatus = 'all' | 'connected' | 'missing_photo' | 'missing_excel' | 'biometric_issue';

export const DatabaseValidation: React.FC<DatabaseValidationProps> = ({
  employees,
  stats,
  onRefreshData,
  onNavigate,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetEmployeeIdRef = useRef<string | null>(null);

  // Groupings & Diagnostics
  const { connectedList, missingPhotoList, missingExcelList, biometricIssueList } = useMemo(() => {
    const connected: Employee[] = [];
    const missingPhoto: Employee[] = [];
    const missingExcel: Employee[] = [];
    const biometricIssue: Employee[] = [];

    employees.forEach((emp) => {
      const isPhotoOnly = emp.extraFields?._isPhotoOnly === 'true' || !emp.nama;
      const hasPhoto = emp.hasPhoto;
      const hasEmbedding = !!(emp.faceDescriptor && emp.faceDescriptor.length > 0);

      if (isPhotoOnly) {
        missingExcel.push(emp);
      } else if (!hasPhoto) {
        missingPhoto.push(emp);
      } else {
        connected.push(emp);
      }

      if (hasPhoto && (!hasEmbedding || emp.photoStatus === 'no_face' || emp.photoStatus === 'multi_face' || emp.photoStatus === 'error')) {
        biometricIssue.push(emp);
      }
    });

    return {
      connectedList: connected,
      missingPhotoList: missingPhoto,
      missingExcelList: missingExcel,
      biometricIssueList: biometricIssue,
    };
  }, [employees]);

  // Filtered display
  const displayedEmployees = useMemo(() => {
    let list: Employee[] = [];
    if (activeFilter === 'all') {
      list = employees;
    } else if (activeFilter === 'connected') {
      list = connectedList;
    } else if (activeFilter === 'missing_photo') {
      list = missingPhotoList;
    } else if (activeFilter === 'missing_excel') {
      list = missingExcelList;
    } else if (activeFilter === 'biometric_issue') {
      list = biometricIssueList;
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((e) => {
      return (
        e.nomor_induk.toLowerCase().includes(q) ||
        (e.nama && e.nama.toLowerCase().includes(q)) ||
        (e.photoFileName && e.photoFileName.toLowerCase().includes(q)) ||
        (e.unit_kerja && e.unit_kerja.toLowerCase().includes(q))
      );
    });
  }, [activeFilter, employees, connectedList, missingPhotoList, missingExcelList, biometricIssueList, searchQuery]);

  // Handle single photo upload to fix missing or invalid photo
  const handleUploadSinglePhoto = (nomorInduk: string) => {
    targetEmployeeIdRef.current = nomorInduk;
    fileInputRef.current?.click();
  };

  const handlePhotoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const nomorInduk = targetEmployeeIdRef.current;
    if (!file || !nomorInduk) return;

    setIsProcessingPhoto(true);
    try {
      const img = await fileToImage(file);
      const result = await processEmployeePhoto(img);

      const targetEmp = employees.find((x) => x.nomor_induk === nomorInduk);
      if (targetEmp) {
        const updated: Employee = {
          ...targetEmp,
          hasPhoto: true,
          photoFileName: file.name,
          photoUrl: result.thumbnailUrl,
          faceDescriptor: result.descriptor,
          photoStatus: result.status,
          photoError: result.errorMessage,
          updatedAt: Date.now(),
        };
        await upsertEmployee(updated);
        onRefreshData();
      }
    } catch (err) {
      alert('Gagal memproses foto: ' + String(err));
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const completionRate = stats.totalExcel > 0 ? Math.round((stats.connected / stats.totalExcel) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePhotoFileSelected}
      />

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Tahap 4 &bull; Validasi Relasi Database</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Validasi Relasi: Nama File Foto &rarr; Nomor Induk &rarr; Data Excel
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Memastikan setiap foto pada folder memiliki Nomor Induk yang cocok persis dengan data kepegawaian di file Excel dan menghasilkan face embedding valid untuk pengenalan live.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onRefreshData}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Perbarui Status
            </button>
            <button
              type="button"
              onClick={() => onNavigate('camera')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              Uji di Kamera Live
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Conceptual Diagram Flow */}
        <div className="mt-5 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Alur Hubungan Relasi Biometrik Pegawai:
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex-1 w-full bg-white p-3 rounded-lg border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 block font-semibold">1. Berkas Foto</span>
              <span className="font-mono font-bold text-blue-700 truncate block">198701012010011001.jpg</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 rotate-90 sm:rotate-0" />
            <div className="flex-1 w-full bg-white p-3 rounded-lg border border-blue-300 text-center bg-blue-50/50">
              <span className="text-[10px] text-blue-600 block font-semibold">2. Kunci Utama (String)</span>
              <span className="font-mono font-bold text-slate-900 block">Nomor Induk</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 rotate-90 sm:rotate-0" />
            <div className="flex-1 w-full bg-white p-3 rounded-lg border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 block font-semibold">3. Baris Excel</span>
              <span className="font-medium text-emerald-700 truncate block">Nama, Jabatan, Unit Kerja</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 rotate-90 sm:rotate-0" />
            <div className="flex-1 w-full bg-white p-3 rounded-lg border border-purple-200 text-center bg-purple-50/50">
              <span className="text-[10px] text-purple-600 block font-semibold">4. AI Biometrik</span>
              <span className="font-medium text-purple-800 block">Embedding 128-d</span>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
            <span className="text-[11px] text-slate-500 font-semibold block">Total di Excel</span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{stats.totalExcel}</div>
            <span className="text-[10px] text-slate-400">Pegawai terdaftar</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
            <span className="text-[11px] text-slate-500 font-semibold block">Total Foto Berkas</span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{stats.totalPhotos}</div>
            <span className="text-[10px] text-slate-400">File foto dimuat</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
            <span className="text-[11px] text-emerald-700 font-semibold block">Terhubung Penuh</span>
            <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5">{stats.connected}</div>
            <span className="text-[10px] text-emerald-600 font-semibold">
              {completionRate}% Kelengkapan
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
            <span className="text-[11px] text-amber-700 font-semibold block">Excel Tanpa Foto</span>
            <div className="text-xl font-bold font-mono text-amber-800 mt-0.5">{stats.excelWithoutPhoto}</div>
            <span className="text-[10px] text-amber-600">Perlu berkas foto</span>
          </div>

          <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-xl">
            <span className="text-[11px] text-purple-700 font-semibold block">Foto Tanpa Excel</span>
            <div className="text-xl font-bold font-mono text-purple-800 mt-0.5">{stats.photoNotFoundInExcel}</div>
            <span className="text-[10px] text-purple-600">Perlu data Excel</span>
          </div>
        </div>
      </div>

      {isProcessingPhoto && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-blue-900">
          <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          <span>Sedang memproses foto baru dan memperbarui embedding biometrik...</span>
        </div>
      )}

      {/* Relational Table & Diagnostic Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter Tabs & Search Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeFilter === 'all'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua Data ({employees.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('connected')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeFilter === 'connected'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              ✓ Terhubung Penuh ({connectedList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('missing_photo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeFilter === 'missing_photo'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              ⚠ Excel Tanpa Foto ({missingPhotoList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('missing_excel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeFilter === 'missing_excel'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-purple-700 hover:bg-purple-50'
              }`}
            >
              Foto Tanpa Excel ({missingExcelList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('biometric_issue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeFilter === 'biometric_issue'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Masalah Biometrik ({biometricIssueList.length})
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Nomor Induk, nama, berkas..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Validation Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4 w-14">Foto</th>
                <th className="py-3 px-4">Nama File Foto</th>
                <th className="py-3 px-4">Nomor Induk (ID)</th>
                <th className="py-3 px-4">Nama Pegawai (Excel)</th>
                <th className="py-3 px-4">Unit Kerja</th>
                <th className="py-3 px-4 text-center">Status Relasi</th>
                <th className="py-3 px-4 text-center">Embedding AI</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Tidak ada data pegawai yang sesuai dengan kategori validasi ini.
                  </td>
                </tr>
              ) : (
                displayedEmployees.map((emp, idx) => {
                  const isPhotoOnly = emp.extraFields?._isPhotoOnly === 'true' || !emp.nama;
                  const hasPhoto = emp.hasPhoto;
                  const isEmbeddingReady = !!(emp.faceDescriptor && emp.faceDescriptor.length > 0);

                  return (
                    <tr key={emp.nomor_induk} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {emp.photoUrl ? (
                            <img
                              src={emp.photoUrl}
                              alt={emp.nama}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {emp.photoFileName ? (
                          <span className="text-slate-900 font-medium">{emp.photoFileName}</span>
                        ) : (
                          <span className="text-amber-600 italic">Tidak ada file foto</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 font-mono font-semibold text-blue-700">
                        {emp.nomor_induk}
                      </td>

                      <td className="py-2.5 px-4">
                        {isPhotoOnly ? (
                          <span className="text-purple-600 italic">Belum ada di Excel</span>
                        ) : (
                          <div className="font-semibold text-slate-900">{emp.nama}</div>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-slate-600">
                        {emp.unit_kerja || '-'}
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        {isPhotoOnly ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-semibold text-[11px]">
                            Foto Saja
                          </span>
                        ) : hasPhoto ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            Terhubung
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-semibold text-[11px]">
                            <AlertTriangle className="w-3 h-3" />
                            Excel Saja
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        {isEmbeddingReady ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-semibold text-[11px]">
                            <Sparkles className="w-3 h-3" />
                            128-d Siap
                          </span>
                        ) : emp.photoStatus === 'no_face' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-semibold text-[11px]" title={emp.photoError}>
                            <XCircle className="w-3 h-3" />
                            Tanpa Wajah
                          </span>
                        ) : emp.photoStatus === 'multi_face' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-semibold text-[11px]" title={emp.photoError}>
                            <AlertTriangle className="w-3 h-3" />
                            Multi Wajah
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleUploadSinglePhoto(emp.nomor_induk)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                          title="Unggah atau ganti foto pegawai ini"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{emp.hasPhoto ? 'Ganti Foto' : 'Unggah Foto'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
