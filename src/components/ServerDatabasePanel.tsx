/**
 * Server Master Database Management Panel
 * Displayed for Admin to monitor and manage the central Master Storage:
 * - Status: ● ONLINE
 * - Total Pegawai, Total Foto, Total Face Embedding
 * - File Excel, Last Update, Storage Path
 * - [ UPDATE EXCEL ], [ UPDATE FOTO ], [ REBUILD EMBEDDING ]
 * - [ BACKUP ], [ RESTORE ], [ SINKRONKAN DATA KE SERVER ]
 */
import React, { useState, useEffect } from 'react';
import { ServerDatabaseStatus, ServerBackupInfo } from '../types';
import {
  fetchServerStatus,
  syncAllDataToServer,
  syncClientWithServerMaster,
  createDatabaseBackup,
  listDatabaseBackups,
  restoreDatabaseBackup,
  resetServerDatabase,
} from '../services/serverDbService';
import { ServerFolderSyncModal } from './ServerFolderSyncModal';
import {
  Server,
  Database,
  FileSpreadsheet,
  Image as ImageIcon,
  Cpu,
  HardDrive,
  RefreshCw,
  Download,
  UploadCloud,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  FolderOpen,
  Trash2,
  ShieldCheck,
  Layers,
  FolderSync,
} from 'lucide-react';

interface ServerDatabasePanelProps {
  onNavigateTab: (tab: any) => void;
  onDataUpdated: () => void;
}

export const ServerDatabasePanel: React.FC<ServerDatabasePanelProps> = ({
  onNavigateTab,
  onDataUpdated,
}) => {
  const [status, setStatus] = useState<ServerDatabaseStatus | null>(null);
  const [backups, setBackups] = useState<ServerBackupInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [showFolderSyncModal, setShowFolderSyncModal] = useState<boolean>(false);

  const loadStatusAndBackups = async () => {
    setIsLoading(true);
    try {
      const [s, bList] = await Promise.all([
        fetchServerStatus(),
        listDatabaseBackups(),
      ]);
      setStatus(s);
      setBackups(bList);
    } catch (err) {
      console.error('Failed to load server database status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatusAndBackups();
  }, []);

  const handleSyncDataToServer = async () => {
    if (!confirm('Kirim seluruh data lokal (identitas pegawai, foto, dan face embedding) ke Master Server? Server akan menyimpan data ini secara permanen.')) {
      return;
    }

    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await syncAllDataToServer();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Berhasil! Seluruh database lokal kini tersimpan di Master Server. Semua komputer client otomatis mendapatkan data ini.',
        });
        await loadStatusAndBackups();
        onDataUpdated();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal melakukan sinkronisasi.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromServer = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await syncClientWithServerMaster();
      if (res.synced) {
        setFeedback({
          type: 'success',
          message: `Berhasil mengunduh & menyinkronkan ${res.employeeCount} data pegawai dari Master Server ke cache komputer ini.`,
        });
        onDataUpdated();
      } else {
        setFeedback({
          type: 'error',
          message: 'Database server belum siap atau tidak memiliki data pegawai.',
        });
      }
      await loadStatusAndBackups();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyinkronkan dari server.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setFeedback(null);
    try {
      const res = await createDatabaseBackup();
      if (res) {
        setFeedback({
          type: 'success',
          message: `Snapshot backup '${res.fileName}' (${(res.sizeBytes / 1024).toFixed(1)} KB) berhasil dibuat dan disimpan permanen di server.`,
        });
        await loadStatusAndBackups();
      } else {
        setFeedback({ type: 'error', message: 'Gagal membuat backup di server.' });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal membuat backup.',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    if (!confirm('Apakah Anda yakin ingin memulihkan database server dari backup ini? Data server saat ini akan ditimpa dengan data backup.')) {
      return;
    }

    setIsRestoring(backupId);
    setFeedback(null);
    try {
      const ok = await restoreDatabaseBackup(backupId);
      if (ok) {
        setFeedback({
          type: 'success',
          message: 'Database server berhasil dipulihkan dari backup! Cache lokal komputer ini otomatis disinkronkan.',
        });
        setShowRestoreModal(false);
        await loadStatusAndBackups();
        onDataUpdated();
      } else {
        setFeedback({ type: 'error', message: 'Gagal memulihkan database dari backup.' });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal memulihkan backup.',
      });
    } finally {
      setIsRestoring(null);
    }
  };

  const handleRebuildEmbedding = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/rebuild-embeddings', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: 'Embedding database server berhasil divalidasi dan diindeks ulang.',
        });
        await loadStatusAndBackups();
        await syncClientWithServerMaster();
        onDataUpdated();
      } else {
        setFeedback({ type: 'error', message: 'Gagal melakukan re-index embedding di server.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Koneksi ke server terputus.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold backdrop-blur-xs mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>SERVER = MASTER DATABASE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Server className="w-7 h-7 text-indigo-400" />
              Database Server Master
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
              Pusat penyimpanan database pegawai, berkas Excel master, foto wajah biometrik, dan 128-D vector embedding. Komputer client (A, B, C) langsung membaca dari server tanpa perlu upload ulang.
            </p>
          </div>

          {/* Online Indicator Badge */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="px-4 py-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Status Server</div>
                <div className="text-sm font-bold text-emerald-400">● ONLINE (Master)</div>
              </div>
            </div>

            <button
              type="button"
              onClick={loadStatusAndBackups}
              disabled={isLoading}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
              title="Refresh status server"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notification feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 text-sm font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">{feedback.message}</div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline opacity-75 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pegawai */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Pegawai</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">
            {status ? status.employeeCount.toLocaleString('id-ID') : '...'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tersimpan di <code className="text-indigo-600 font-mono">database/pegawai.json</code>
          </p>
        </div>

        {/* Total Foto */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Foto Pegawai</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">
            {status ? status.photoCount.toLocaleString('id-ID') : '...'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Folder storage <code className="text-purple-600 font-mono">photos/[id].jpg</code>
          </p>
        </div>

        {/* Total Face Embedding */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Face Embedding</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">
            {status ? status.embeddingCount.toLocaleString('id-ID') : '...'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Vektor 128-D <code className="text-emerald-600 font-mono">embeddings.json</code>
          </p>
        </div>

        {/* Storage Health */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Storage Server</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <span className="text-emerald-600">READY</span>
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-600">v{status?.version || 1}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 truncate" title={status?.storagePath || '/app/storage'}>
            Path: <span className="font-mono text-slate-700">{status?.storagePath || '/app/storage'}</span>
          </p>
        </div>
      </div>

      {/* Information Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Detail Konfigurasi Master Storage
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500 font-medium block">File Excel Master:</span>
            <span className="font-bold text-slate-900 font-mono text-sm mt-0.5 block flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              {status?.excelFileName || 'pegawai.xlsx'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">Tersimpan di /storage/excel/</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500 font-medium block">Terakhir Diperbarui:</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              {formatTimestamp(status?.lastUpdated)}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">Sinkronisasi versi: v{status?.version || 1}</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500 font-medium block">Total Backup Snapshot:</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-600" />
              {backups.length} Arsip Tersimpan
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">Tersimpan di /storage/backups/</span>
          </div>
        </div>
      </div>

      {/* Action Command Center (ADMIN) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-indigo-600" />
          Aksi Manajemen Database Server
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* SINKRONISASI DATA SERVER */}
          <button
            type="button"
            onClick={() => setShowFolderSyncModal(true)}
            className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60 active:bg-indigo-200/50 text-indigo-950 flex items-center gap-3 transition-all text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wide text-indigo-900">[ SINKRONISASI DATA SERVER ]</div>
              <div className="text-[11px] text-indigo-700 mt-0.5">Pindai /storage/excel/ dan /storage/photos/</div>
            </div>
          </button>

          {/* STORAGE FOLDER SERVER */}
          <button
            type="button"
            onClick={() => onNavigateTab('server_sync')}
            className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 active:bg-blue-200/50 text-blue-950 flex items-center gap-3 transition-all text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wide text-blue-900">[ STORAGE FOLDER SERVER ]</div>
              <div className="text-[11px] text-blue-700 mt-0.5">Kelola berkas folder server & catatan log</div>
            </div>
          </button>

          {/* SINKRONKAN DATA KE SERVER */}
          <button
            type="button"
            onClick={handleSyncDataToServer}
            disabled={isSyncing}
            className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60 active:bg-indigo-200/50 text-indigo-950 flex items-center gap-3 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <UploadCloud className={`w-5 h-5 ${isSyncing ? 'animate-bounce' : ''}`} />
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wide text-indigo-900">
                [ SINKRONKAN DATA KE SERVER ]
              </div>
              <div className="text-[11px] text-indigo-700 mt-0.5">
                Migrasi data komputer ini ke master storage
              </div>
            </div>
          </button>

          {/* REBUILD EMBEDDING */}
          <button
            type="button"
            onClick={handleRebuildEmbedding}
            disabled={isSyncing}
            className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/60 active:bg-purple-200/50 text-purple-950 flex items-center gap-3 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wide text-purple-900">
                [ REBUILD EMBEDDING ]
              </div>
              <div className="text-[11px] text-purple-700 mt-0.5">
                Re-index dan verifikasi vektor biometrik
              </div>
            </div>
          </button>

          {/* BACKUP DATABASE */}
          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={isBackingUp}
            className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 active:bg-amber-200/50 text-amber-950 flex items-center gap-3 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Download className={`w-5 h-5 ${isBackingUp ? 'animate-bounce' : ''}`} />
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wide text-amber-900">
                [ BACKUP DATABASE ]
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                Buat snapshot arsip permanen di server
              </div>
            </div>
          </button>

          {/* RESTORE DATABASE */}
          <button
            type="button"
            onClick={() => setShowRestoreModal(true)}
            className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/50 hover:bg-cyan-100/60 active:bg-cyan-200/50 text-cyan-950 flex items-center gap-3 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wide text-cyan-900">
                [ RESTORE DATABASE ]
              </div>
              <div className="text-[11px] text-cyan-700 mt-0.5">
                Pulihkan database dari arsip ({backups.length})
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Restore Backups Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-indigo-600" />
                  Daftar Snapshot Backup Server
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih snapshot arsip untuk memulihkan seluruh database server.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {backups.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Belum ada berkas backup yang dibuat di server. Silakan klik tombol <strong>[ BACKUP DATABASE ]</strong> terlebih dahulu.
                </div>
              ) : (
                backups.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-colors flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 font-mono">{b.fileName}</div>
                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                        <span>📅 {formatTimestamp(new Date(b.createdAt).toISOString())}</span>
                        <span>👥 {b.employeeCount} Pegawai</span>
                        <span>📷 {b.photoCount} Foto</span>
                        <span>💾 {(b.sizeBytes / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestore(b.id)}
                      disabled={isRestoring === b.id}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors"
                    >
                      {isRestoring === b.id ? 'Memulihkan...' : 'Pulihkan'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server Folder Sync Modal */}
      <ServerFolderSyncModal
        isOpen={showFolderSyncModal}
        onClose={() => setShowFolderSyncModal(false)}
        onSyncComplete={async () => {
          await loadStatusAndBackups();
          await syncClientWithServerMaster();
          onDataUpdated();
        }}
      />
    </div>
  );
};
