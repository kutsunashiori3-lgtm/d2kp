/**
 * Recognition History component for viewing, filtering, and exporting attendance logs.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { RecognitionLog } from '../types';
import { getAllLogs, clearAllLogs } from '../services/database';
import { exportLogsToExcel } from '../services/excelParser';
import { recognitionLogger } from '../services/recognitionLogger';
import {
  History,
  Download,
  Trash2,
  Search,
  Calendar,
  ShieldCheck,
  Building2,
  Clock,
  CheckCircle2,
  Camera,
  FileImage,
} from 'lucide-react';

export const RecognitionHistory: React.FC = () => {
  const [logs, setLogs] = useState<RecognitionLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [unitFilter, setUnitFilter] = useState<string>('all');

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await getAllLogs();
      setLogs(data);
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // Subscribe to real-time logs from camera
    const unsubscribe = recognitionLogger.subscribe((newLog) => {
      setLogs((prev) => [newLog, ...prev]);
    });
    return () => unsubscribe();
  }, []);

  // Unique unit kerja list
  const unitList = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.unit_kerja && l.unit_kerja !== '-') set.add(l.unit_kerja);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = log.nama.toLowerCase().includes(q);
        const matchId = log.nomor_induk.toLowerCase().includes(q);
        const matchNip = log.nip?.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchNip) return false;
      }

      // Unit
      if (unitFilter !== 'all' && log.unit_kerja !== unitFilter) {
        return false;
      }

      // Date filter
      if (dateFilter) {
        // dateFilter is YYYY-MM-DD, log.dateStr is DD-MM-YYYY
        const [y, m, d] = dateFilter.split('-');
        const expected = `${d}-${m}-${y}`;
        if (log.dateStr !== expected) return false;
      }

      return true;
    });
  }, [logs, searchQuery, unitFilter, dateFilter]);

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      alert('Tidak ada data riwayat untuk diekspor.');
      return;
    }
    exportLogsToExcel(filteredLogs);
  };

  const handleClearHistory = async () => {
    if (confirm('Yakin ingin menghapus seluruh data riwayat pengenalan wajah? Tindakan ini tidak dapat dibatalkan.')) {
      await clearAllLogs();
      setLogs([]);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Riwayat Pengenalan Wajah
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Log absensi dan identifikasi biometrik real-time pegawai ({filteredLogs.length} rekaman).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={filteredLogs.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor ke Excel
            </button>

            <button
              type="button"
              onClick={handleClearHistory}
              disabled={logs.length === 0}
              className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 disabled:opacity-40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Riwayat
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau nomor induk..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date filter */}
          <div className="relative">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Unit filter */}
          <div className="relative">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Unit Kerja</option>
              {unitList.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Reset filter */}
          {(searchQuery || dateFilter || unitFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDateFilter('');
                setUnitFilter('all');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 w-12 text-center">No</th>
              <th className="py-3 px-4">Tanggal & Jam</th>
              <th className="py-3 px-4 text-center">Jenis</th>
              <th className="py-3 px-4 w-14">Foto</th>
              <th className="py-3 px-4">Nomor Induk</th>
              <th className="py-3 px-4">Nama Pegawai</th>
              <th className="py-3 px-4">Unit Kerja</th>
              <th className="py-3 px-4 text-center">Kecocokan</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-400">
                  Memuat data riwayat...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-600">Belum ada riwayat pengenalan wajah.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Gunakan tab "Kamera" atau "Identifikasi Foto" untuk mengenali identitas pegawai.
                  </p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => (
                <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 text-center text-slate-400 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-700">
                    <div className="font-semibold">{log.timeStr}</div>
                    <div className="text-[11px] text-slate-400">{log.dateStr}</div>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {log.sourceType === 'Manual Photo' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-semibold text-[10px]">
                        <FileImage className="w-3 h-3 text-blue-600" />
                        Foto
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-semibold text-[10px]">
                        <Camera className="w-3 h-3 text-slate-600" />
                        Kamera
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                      {log.photoUrl ? (
                        <img
                          src={log.photoUrl}
                          alt={log.nama}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">N/A</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-blue-700">
                    {log.nomor_induk}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">
                    {log.nama}
                    {log.jabatan && log.jabatan !== '-' && (
                      <div className="text-[11px] text-slate-400 font-normal">{log.jabatan}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">
                    {log.unit_kerja || '-'}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="font-mono font-semibold text-emerald-700">
                      {log.confidence}%
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-semibold text-[11px]">
                      <CheckCircle2 className="w-3 h-3" />
                      Recognized
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
