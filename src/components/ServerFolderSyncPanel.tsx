import React, { useState, useEffect } from 'react';
import {
  Server,
  FolderSync,
  RefreshCw,
  FolderOpen,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  HardDrive,
  Copy,
  ExternalLink,
  Search,
  Filter,
} from 'lucide-react';
import {
  fetchServerSyncStatus,
  fetchSyncLog,
  fetchServerStorageFiles,
  ServerSyncSummary,
} from '../services/serverDbService';
import { ServerFolderSyncModal } from './ServerFolderSyncModal';

export const ServerFolderSyncPanel: React.FC = () => {
  const [statusData, setStatusData] = useState<any>(null);
  const [syncLog, setSyncLog] = useState<string>('');
  const [storageFiles, setStorageFiles] = useState<{
    excelFiles: Array<{ name: string; size: number; mtime: number; path: string }>;
    totalPhotos: number;
    photoSample: Array<{ name: string; nomorInduk: string; size: number; mtime: number; status: string; hasEmbedding: boolean }>;
  }>({ excelFiles: [], totalPhotos: 0, photoSample: [] });

  const [activeTab, setActiveTab] = useState<'overview' | 'excel' | 'photos' | 'logs' | 'guide'>('overview');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [photoSearchQuery, setPhotoSearchQuery] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [status, log, files] = await Promise.all([
        fetchServerSyncStatus(),
        fetchSyncLog(),
        fetchServerStorageFiles(),
      ]);
      setStatusData(status);
      setSyncLog(log);
      setStorageFiles(files);
    } catch (err) {
      console.error('Failed to load server sync data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredPhotos = storageFiles.photoSample.filter((p) =>
    p.nomorInduk.toLowerCase().includes(photoSearchQuery.toLowerCase()) ||
    p.name.toLowerCase().includes(photoSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / System Architecture */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <FolderSync className="w-3.5 h-3.5" />
              <span>Sistem Folder Server Otomatis &bull; Single Source of Truth</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Penyimpanan & Sinkronisasi Folder Server
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Admin cukup menyalin berkas Excel dan Foto pegawai secara manual ke folder server. Server secara otomatis memindai perubahan, membaca NIP/Nomor Induk, dan mengenerate biometrik wajah.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>SINKRONISASI DATA SERVER</span>
            </button>
            <button
              type="button"
              onClick={loadData}
              className="px-4 py-3.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold text-xs rounded-2xl border border-white/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Segarkan Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARD STATUS DATA SERVER (Exact user specification) */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2.5 font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>DATA SERVER (Single Source of Truth)</span>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Status Server: CONNECTED
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 font-mono">
          {/* 1. Excel Master */}
          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Excel Master</div>
            <div className="text-lg font-bold text-blue-400 mt-1 truncate" title={statusData?.excelMaster || 'master_pegawai.xlsx'}>
              {statusData?.excelMaster || 'master_pegawai.xlsx'}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">/storage/excel/</span>
          </div>

          {/* 2. Jumlah Pegawai */}
          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Jumlah Pegawai</div>
            <div className="text-2xl font-extrabold text-white mt-1">
              {statusData ? statusData.totalEmployees.toLocaleString('id-ID') : '...'}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Database Server</span>
          </div>

          {/* 3. Jumlah Foto */}
          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Jumlah Foto</div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1">
              {statusData ? statusData.totalPhotos.toLocaleString('id-ID') : '...'}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">/storage/photos/</span>
          </div>

          {/* 4. Face Embedding */}
          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Face Embedding</div>
            <div className="text-2xl font-extrabold text-purple-400 mt-1">
              {statusData ? statusData.totalEmbeddings.toLocaleString('id-ID') : '...'}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">128-D Biometrik Siap</span>
          </div>

          {/* 5. Foto Belum Diproses */}
          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Foto Belum Diproses</div>
            <div className="text-2xl font-extrabold text-amber-400 mt-1">
              {statusData ? Math.max(0, statusData.totalPhotos - statusData.totalEmbeddings).toLocaleString('id-ID') : '0'}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Perlu Sinkronisasi</span>
          </div>

          {/* 6. Terakhir Sinkronisasi */}
          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
            <div className="text-slate-400 text-xs">Terakhir Sinkronisasi</div>
            <div className="text-xs font-bold text-slate-200 mt-2 truncate">
              {statusData?.lastSyncTime
                ? new Date(statusData.lastSyncTime).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Belum Ada'}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Waktu Server</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Struktur Folder Server</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'excel'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Folder Excel ({storageFiles.excelFiles.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('photos')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'photos'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Folder Foto ({storageFiles.totalPhotos.toLocaleString('id-ID')})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Log Sinkronisasi (sync.log)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('guide')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'guide'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Panduan Salin Berkas</span>
        </button>
      </div>

      {/* Tab 1: Overview & Directory Tree */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Visual Directory Tree */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-600" />
              <span>Peta Direktori Storage Server</span>
            </h3>

            <div className="bg-slate-950 text-slate-300 rounded-2xl p-5 font-mono text-xs leading-relaxed overflow-x-auto border border-slate-800">
              <div className="text-emerald-400 font-bold">SERVER</div>
              <div className="text-slate-400">└── storage</div>
              <div className="text-slate-300 ml-4">
                ├── <span className="text-blue-400 font-bold">excel/</span>
                <span className="text-slate-400 text-[11px] ml-2"># Salin file master_pegawai.xlsx di sini</span>
              </div>
              <div className="text-slate-400 ml-8">
                └── <span className="text-slate-200">master_pegawai.xlsx</span>
              </div>
              <div className="text-slate-300 ml-4 mt-1">
                ├── <span className="text-amber-400 font-bold">photos/</span>
                <span className="text-slate-400 text-[11px] ml-2"># Salin foto [nomor_induk].jpg di sini</span>
              </div>
              <div className="text-slate-400 ml-8">
                ├── 1987654321.jpg<br />
                ├── 1987654322.jpg<br />
                └── dst... ({storageFiles.totalPhotos.toLocaleString('id-ID')} foto tersimpan)
              </div>
              <div className="text-slate-300 ml-4 mt-1">
                ├── <span className="text-purple-400 font-bold">database/</span>
                <span className="text-slate-400 text-[11px] ml-2"># Master pegawai.json & file_tracking.json</span>
              </div>
              <div className="text-slate-300 ml-4">
                ├── <span className="text-indigo-400 font-bold">embeddings/</span>
                <span className="text-slate-400 text-[11px] ml-2"># embeddings.json (128-D biometrik)</span>
              </div>
              <div className="text-slate-300 ml-4">
                └── <span className="text-pink-400 font-bold">logs/</span>
                <span className="text-slate-400 text-[11px] ml-2"># sync.log (catatan otomatis sistem)</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Otomatisasi Penuh:</span>
              </div>
              <p>
                Ketika Anda menyalin file Excel atau Foto ke folder server, watcher server mendeteksi perubahan tersebut secara otomatis. Komputer client (Komputer A, B, C) langsung dapat menggunakan data terbaru tanpa perlu upload manual lewat browser.
              </p>
            </div>
          </div>

          {/* Quick Actions & Recent Log snippet */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Catatan Log Sinkronisasi Terbaru</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                Lihat Semua &rarr;
              </button>
            </div>

            <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 font-mono text-[11px] h-64 overflow-y-auto border border-slate-800 space-y-1">
              {syncLog ? (
                syncLog.split('\n').slice(-15).map((line, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-slate-400">Belum ada catatan log sinkronisasi.</div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-slate-500 font-mono">Lokasi file: /storage/logs/sync.log</span>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sinkronisasi Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Folder Excel */}
      {activeTab === 'excel' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Berkas Excel di /storage/excel/</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                File Excel yang terbaca secara otomatis oleh server dari folder server.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Periksa Perubahan Excel</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama File</th>
                  <th className="py-3 px-4">Ukuran</th>
                  <th className="py-3 px-4">Terakhir Diubah</th>
                  <th className="py-3 px-4">Path Server</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {storageFiles.excelFiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Tidak ada file Excel di folder /storage/excel/.
                    </td>
                  </tr>
                ) : (
                  storageFiles.excelFiles.map((file, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>{file.name}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">{formatFileSize(file.size)}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(file.mtime).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{file.path}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Aktif (Master)
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Folder Foto */}
      {activeTab === 'photos' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>Berkas Foto di /storage/photos/ ({storageFiles.totalPhotos.toLocaleString('id-ID')} Total)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Foto pegawai yang tersimpan di server. Nama file sesuai Nomor Induk/NIP pegawai.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari Nomor Induk..."
                  value={photoSearchQuery}
                  onChange={(e) => setPhotoSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs w-56 focus:outline-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsSyncModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sinkronisasi Foto</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Preview</th>
                  <th className="py-3 px-4">Nomor Induk / Nama File</th>
                  <th className="py-3 px-4">Ukuran</th>
                  <th className="py-3 px-4">Terakhir Diubah</th>
                  <th className="py-3 px-4">Biometrik Wajah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPhotos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Tidak ada foto yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredPhotos.slice(0, 50).map((photo, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-2 px-4">
                        <img
                          src={`/api/photos/${photo.nomorInduk}`}
                          alt={photo.nomorInduk}
                          className="w-9 h-9 object-cover rounded-lg border border-slate-200 shadow-2xs"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="gray" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
                          }}
                        />
                      </td>
                      <td className="py-2 px-4">
                        <div className="font-mono font-bold text-slate-900">{photo.nomorInduk}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{photo.name}</div>
                      </td>
                      <td className="py-2 px-4 text-slate-600 font-mono">{formatFileSize(photo.size)}</td>
                      <td className="py-2 px-4 text-slate-600">
                        {new Date(photo.mtime).toLocaleString('id-ID')}
                      </td>
                      <td className="py-2 px-4">
                        {photo.hasEmbedding ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <CheckCircle2 className="w-3 h-3 text-purple-600" />
                            Embedding Siap (128-D)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending Embedding
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredPhotos.length > 50 && (
            <p className="text-[11px] text-slate-400 font-mono text-center">
              Menampilkan 50 dari {filteredPhotos.length.toLocaleString('id-ID')} berkas foto. Gunakan kolom pencarian di atas untuk menyaring Nomor Induk tertentu.
            </p>
          )}
        </div>
      )}

      {/* Tab 4: Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Berkas Log: /storage/logs/sync.log</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Catatan riwayat pemindaian folder, parsing Excel, ekstraksi wajah, dan pembaruan database.
              </p>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Segarkan Log</span>
            </button>
          </div>

          <div className="bg-slate-950 text-slate-200 rounded-2xl p-5 font-mono text-xs h-96 overflow-y-auto border border-slate-800 space-y-1">
            {syncLog ? (
              syncLog.split('\n').map((line, idx) => (
                <div key={idx} className="leading-relaxed">
                  {line}
                </div>
              ))
            ) : (
              <div className="text-slate-400">Belum ada catatan log sinkronisasi.</div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Panduan Salin Berkas */}
      {activeTab === 'guide' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-indigo-600" />
              <span>Panduan Menyalin Berkas Manual ke Server</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Sebagai administrator, Anda tidak perlu lagi melakukan import berulang lewat browser. Cukup salin berkas ke folder server berikut:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Folder Excel */}
            <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
              <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>1. Folder Excel (/storage/excel/)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Salin file Excel pegawai ke folder:
                <code className="block my-2 p-2 bg-white rounded-xl border border-indigo-200 font-mono text-[11px] text-indigo-950">
                  /storage/excel/master_pegawai.xlsx
                </code>
                Kolom wajib mencakup: <strong>Nomor Induk / NIP</strong> dan <strong>Nama</strong>. Kolom lain seperti Jabatan, Pangkat, Golongan, Unit Kerja, dan Instansi akan otomatis terpetakan secara dinamis.
              </p>
            </div>

            {/* Folder Photos */}
            <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
              <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>2. Folder Foto (/storage/photos/)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Salin foto pegawai dengan format penamaan nama file berupa <strong>Nomor Induk</strong>:
                <code className="block my-2 p-2 bg-white rounded-xl border border-indigo-200 font-mono text-[11px] text-indigo-950">
                  /storage/photos/1987654321.jpg<br />
                  /storage/photos/1987654322.jpg
                </code>
                Format yang didukung: <code>.jpg</code>, <code>.jpeg</code>, <code>.png</code>, <code>.webp</code>.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3 font-mono text-xs">
            <div className="text-emerald-400 font-bold flex items-center gap-2">
              <Server className="w-4 h-4" />
              <span>Contoh Perintah Menyalin File ke Server via SCP atau Docker</span>
            </div>
            <div className="space-y-2 text-slate-300">
              <p className="text-slate-400"># Jika menggunakan Docker Volume (folder ./storage):</p>
              <div className="bg-black/40 p-2.5 rounded-xl border border-slate-800">
                cp master_pegawai.xlsx ./storage/excel/<br />
                cp -r ./koleksi_foto/* ./storage/photos/
              </div>
              <p className="text-slate-400 mt-2"># Jika menyalin dari komputer lain via SCP:</p>
              <div className="bg-black/40 p-2.5 rounded-xl border border-slate-800">
                scp master_pegawai.xlsx user@ip-server:/path/storage/excel/<br />
                scp *.jpg user@ip-server:/path/storage/photos/
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Modal */}
      <ServerFolderSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={() => loadData()}
      />
    </div>
  );
};
