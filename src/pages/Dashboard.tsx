/**
 * Main Dashboard page showing statistics, validation status, quick actions,
 * and recent recognition activity.
 */
import React, { useState } from 'react';
import { DatabaseStats, Employee, RecognitionLog, ServerDatabaseStatus } from '../types';
import { AuthUser } from '../services/authService';
import { getSampleEmployeesWithAvatars } from '../services/sampleDataGenerator';
import { saveEmployees } from '../services/database';
import { ServerFolderSyncModal } from '../components/ServerFolderSyncModal';
import {
  Users,
  Camera,
  FileImage,
  FolderOpen,
  FileSpreadsheet,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  Sparkles,
  RefreshCw,
  Award,
  Server,
  HardDrive,
  FolderSync,
} from 'lucide-react';

interface DashboardProps {
  stats: DatabaseStats;
  employees: Employee[];
  recentLogs: RecognitionLog[];
  serverStatus?: ServerDatabaseStatus | null;
  currentUser?: AuthUser | null;
  onNavigate: (tab: 'camera' | 'photo_identification' | 'server_db' | 'server_sync' | 'import_excel' | 'import_folder' | 'validation' | 'database' | 'history' | 'settings') => void;
  onRefreshData: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  employees,
  recentLogs,
  serverStatus,
  currentUser,
  onNavigate,
  onRefreshData,
}) => {
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const handleLoadDemoData = async () => {
    if (confirm('Muat data contoh (5 pegawai BKPSDM, BKAD, Diskominfo lengkap dengan foto)? Ini memudahkan pengujian sistem.')) {
      const demoData = getSampleEmployeesWithAvatars();
      await saveEmployees(demoData);
      onRefreshData();
      alert('Data demo berhasil dimuat ke database!');
    }
  };

  const isExcelReady = stats.totalExcel > 0;
  const isPhotoReady = stats.totalPhotos > 0;
  const isEmbeddingReady = stats.embeddingReady > 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action Buttons */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-blue-200 backdrop-blur-xs mb-3">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>Sistem Presensi & Identifikasi Biometrik Wajah Lokal</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Face Recognition Pegawai
            </h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Pencocokan wajah otomatis real-time melalui kamera webcam, menghubungkan database foto berkas dengan data kepegawaian Excel menggunakan primary key <span className="text-emerald-300 font-semibold font-mono">Nomor Induk</span>.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('camera')}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2.5 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Mulai Kamera</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('photo_identification')}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2.5 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <FileImage className="w-4 h-4" />
              <span>Identifikasi Foto</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {currentUser?.role === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(true)}
                  className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>SINKRONISASI DATA SERVER</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('server_sync')}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold text-xs rounded-xl backdrop-blur-xs border border-white/15 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <FolderSync className="w-4 h-4 text-emerald-400" />
                  <span>Penyimpanan Server</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('server_db')}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold text-xs rounded-xl backdrop-blur-xs border border-white/15 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Server className="w-4 h-4 text-indigo-300" />
                  <span>Database Server</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Master Server Storage Ribbon */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Master Server Database</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE (v{serverStatus?.version || 1})
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pusat penyimpanan database master server. Data otomatis tersedia untuk seluruh komputer client ({employees.length} pegawai tersinkron).
            </p>
          </div>
        </div>

        {currentUser?.role === 'admin' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sinkronisasi Data Server</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('server_sync')}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderSync className="w-3.5 h-3.5 text-indigo-600" />
              <span>Folder Storage</span>
            </button>
          </div>
        )}
      </div>

      {/* STATUS DATA SERVER (Single Source of Truth - User Specification) */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-2">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>DATA SERVER (Single Source of Truth)</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 font-mono cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>SINKRONISASI SEKARANG</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Status Server: CONNECTED
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 font-mono">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Excel Master</div>
            <div className="text-base font-bold text-blue-400 mt-1 truncate" title={serverStatus?.excelFileName || 'master_pegawai.xlsx'}>
              {serverStatus?.excelFileName || 'master_pegawai.xlsx'}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">/storage/excel/</span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Jumlah Pegawai</div>
            <div className="text-xl font-extrabold text-white mt-1">
              {serverStatus ? serverStatus.employeeCount.toLocaleString('id-ID') : '...'}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Database Server</span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Jumlah Foto</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-1">
              {serverStatus ? serverStatus.photoCount.toLocaleString('id-ID') : '...'}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">/storage/photos/</span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Face Embedding</div>
            <div className="text-xl font-extrabold text-purple-400 mt-1">
              {serverStatus ? serverStatus.embeddingCount.toLocaleString('id-ID') : '...'}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">128-D Vektor Wajah</span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Foto Belum Diproses</div>
            <div className="text-xl font-extrabold text-amber-400 mt-1">
              {serverStatus ? Math.max(0, serverStatus.photoCount - serverStatus.embeddingCount).toLocaleString('id-ID') : '0'}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Perlu Sinkron</span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Terakhir Sinkronisasi</div>
            <div className="text-xs font-bold text-slate-200 mt-2 truncate">
              {serverStatus?.lastUpdated
                ? new Date(serverStatus.lastUpdated).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Belum Ada'}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Waktu Server</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* 1. Total Pegawai (Excel) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-600">Total Pegawai</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{stats.totalExcel}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Dari file Excel</span>
        </div>

        {/* 2. Total Foto */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-600">Database Foto</span>
            <FolderOpen className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{stats.totalPhotos}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Dari folder foto</span>
        </div>

        {/* 3. Terhubung */}
        <div className="bg-white rounded-2xl border border-emerald-200/80 p-4 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold text-emerald-800">Terhubung</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono">{stats.connected}</div>
          <span className="text-[11px] text-emerald-600 mt-1 block">Foto & Excel Cocok</span>
        </div>

        {/* 4. Embedding Siap */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-600">Embedding Siap</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-700 font-mono">{stats.embeddingReady}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Vektor Biometrik</span>
        </div>

        {/* 5. Foto Tidak Ditemukan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-600">Tanpa Foto</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700 font-mono">{stats.excelWithoutPhoto}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Excel tanpa berkas foto</span>
        </div>

        {/* 6. Foto Tanpa Excel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-600">Foto Tak Di Excel</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-700 font-mono">{stats.photoNotFoundInExcel}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Nomor Induk belum ada</span>
        </div>
      </div>

      {/* Main Row: Validation Dashboard + Recent Recognition Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Validation Dashboard (Section 9 & 17 of Prompt) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Validasi Database & Status Kesiapan
              </h3>
              <button
                type="button"
                onClick={onRefreshData}
                title="Perbarui Data"
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Item 1: Excel Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-3">
                  {isExcelReady ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-800">Database Excel Pegawai</div>
                    <div className="text-[11px] text-slate-500">
                      {isExcelReady
                        ? `${stats.totalExcel} data pegawai berhasil dibaca`
                        : 'Belum ada data Excel yang diimpor'}
                    </div>
                  </div>
                </div>
                {!isExcelReady && (
                  <button
                    type="button"
                    onClick={() => onNavigate('import_excel')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    Import Sekarang
                  </button>
                )}
              </div>

              {/* Item 2: Folder Photo Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-3">
                  {isPhotoReady ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-800">Folder Foto Pegawai</div>
                    <div className="text-[11px] text-slate-500">
                      {isPhotoReady
                        ? `${stats.totalPhotos} foto termuat (Nama file = Nomor Induk)`
                        : 'Belum ada folder foto yang diimpor'}
                    </div>
                  </div>
                </div>
                {!isPhotoReady && (
                  <button
                    type="button"
                    onClick={() => onNavigate('import_folder')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    Pilih Folder
                  </button>
                )}
              </div>

              {/* Item 3: Embedding Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-3">
                  {isEmbeddingReady ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-800">Model & Embedding Wajah</div>
                    <div className="text-[11px] text-slate-500">
                      {isEmbeddingReady
                        ? `${stats.embeddingReady} wajah siap dikenali secara instan`
                        : 'Embedding belum digenerate'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Relasi: <strong className="text-emerald-700">{stats.connected} Terhubung</strong>, <strong className="text-amber-700">{stats.excelWithoutPhoto} Belum Ada Foto</strong>
              </span>
              <button
                type="button"
                onClick={() => onNavigate('validation')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
              >
                <span>Buka Halaman Validasi Lengkap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Demo Dataset Loader */}
            {stats.totalExcel === 0 && stats.totalPhotos === 0 && (
              <div className="mt-5 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-blue-900">Ingin Menguji Sistem Langsung?</h4>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    Muat 5 data pegawai contoh berserta avatar dan foto untuk uji coba kamera langsung.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadDemoData}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-xs"
                >
                  Muat Data Demo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Recognition History widget */}
        <div className="lg:col-span-6 flex flex-col">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Aktivitas Pengenalan Terbaru
              </h3>
              {recentLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Lihat Semua
                </button>
              )}
            </div>

            {recentLogs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Camera className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">Belum ada aktivitas deteksi kamera.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Aktivitas pengenalan wajah akan otomatis muncul di sini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden">
                {recentLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {log.photoUrl ? (
                          <img
                            src={log.photoUrl}
                            alt={log.nama}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">N/A</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {log.nama}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {log.nomor_induk} &bull; {log.unit_kerja}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-emerald-700">
                        {log.confidence}%
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {log.timeStr}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Server Folder Sync Modal */}
      <ServerFolderSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={() => {
          onRefreshData();
        }}
      />
    </div>
  );
};
