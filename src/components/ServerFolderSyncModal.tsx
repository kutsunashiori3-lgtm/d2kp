import React, { useState } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Image as ImageIcon,
  Database,
  X,
  FileText,
  Clock,
} from 'lucide-react';
import { triggerServerFolderSync, ServerSyncSummary } from '../services/serverDbService';

interface ServerFolderSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (summary: ServerSyncSummary) => void;
}

export const ServerFolderSyncModal: React.FC<ServerFolderSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [summary, setSummary] = useState<ServerSyncSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartSync = async () => {
    setIsRunning(true);
    setErrorMessage(null);
    setSummary(null);
    setProgressPercent(5);
    setProgressMsg('Menghubungi server dan memeriksa folder storage...');

    try {
      const result = await triggerServerFolderSync((current, total, message) => {
        setProgressMsg(message);
        if (total > 0) {
          const pct = Math.min(95, Math.round((current / total) * 100));
          setProgressPercent(pct);
        }
      });

      setProgressPercent(100);
      setProgressMsg('Sinkronisasi folder server berhasil diselesaikan.');
      setSummary(result);
      onSyncComplete?.(result);
    } catch (err) {
      console.error('Sync failed:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kegagalan saat sinkronisasi folder server.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <RefreshCw className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">Sinkronisasi Data Server</h3>
              <p className="text-xs text-slate-300 mt-0.5">Membaca otomatis /storage/excel/ dan /storage/photos/</p>
            </div>
          </div>
          {!isRunning && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {!summary && !isRunning && !errorMessage && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs text-indigo-950 leading-relaxed">
                <p className="font-semibold text-indigo-900 mb-1 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-indigo-600" />
                  Sistem Folder Server Otomatis
                </p>
                Aplikasi akan memindai folder server:
                <ul className="list-disc list-inside mt-1.5 space-y-0.5 font-mono text-[11px] text-indigo-800">
                  <li>/storage/excel/ &rarr; Membaca berkas data pegawai</li>
                  <li>/storage/photos/ &rarr; Membaca foto berdasarkan Nomor Induk</li>
                </ul>
                <p className="mt-2 text-slate-600 font-sans">
                  Embedding biometrik akan digenerate otomatis untuk foto baru atau foto yang dimodifikasi.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleStartSync}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Jalankan Sinkronisasi Sekarang</span>
                </button>
              </div>
            </div>
          )}

          {/* Running Progress State */}
          {isRunning && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center text-indigo-600 relative">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Sinkronisasi Sedang Berjalan</h4>
                <p className="text-xs text-slate-500 mt-1 font-mono">{progressMsg}</p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 font-mono">{progressPercent}% Selesai</p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-red-900">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>Gagal Sinkronisasi Server</span>
              </div>
              <p>{errorMessage}</p>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleStartSync}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          )}

          {/* Completed Summary Report (Exact format required by user) */}
          {summary && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">Sinkronisasi Selesai</h4>
                  <p className="text-xs text-emerald-700">Data server berhasil diperbarui secara menyeluruh.</p>
                </div>
              </div>

              {/* Exact format summary card */}
              <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 font-mono text-xs border border-slate-800 shadow-inner space-y-2.5">
                <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider pb-1 border-b border-slate-800 flex items-center justify-between">
                  <span>HASIL SINKRONISASI DATA SERVER</span>
                  <span className="text-slate-400 font-normal">{summary.syncTime}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Pegawai:</span>
                  <span className="font-bold text-white">{summary.totalEmployees.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Foto ditemukan:</span>
                  <span className="font-bold text-emerald-400">{summary.totalPhotos.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Embedding berhasil:</span>
                  <span className="font-bold text-purple-400">{summary.totalEmbeddings.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Foto baru:</span>
                  <span className="font-bold text-blue-400">{summary.newPhotos.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Foto diperbarui:</span>
                  <span className="font-bold text-amber-400">{summary.updatedPhotos.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex justify-between py-0.5 border-t border-slate-800 pt-1.5">
                  <span className="text-slate-400">Foto tidak ditemukan:</span>
                  <span className="font-bold text-slate-300">{summary.missingPhotos.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
