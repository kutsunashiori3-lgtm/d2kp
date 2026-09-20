/**
 * Database Table component for viewing, searching, filtering, and managing employee records.
 */
import React, { useState, useMemo, useRef } from 'react';
import { Employee } from '../types';
import { deleteEmployee, upsertEmployee } from '../services/database';
import { fileToImage } from '../services/imageProcessor';
import { processEmployeePhoto } from '../services/faceRecognition';
import {
  Search,
  Filter,
  Trash2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  User,
  Building2,
  Briefcase,
  Award,
  RefreshCw,
} from 'lucide-react';

interface DatabaseTableProps {
  employees: Employee[];
  onDataChanged: () => void;
}

export const DatabaseTable: React.FC<DatabaseTableProps> = ({
  employees,
  onDataChanged,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState<Employee | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetEmployeeIdRef = useRef<string | null>(null);

  // Extract unique Unit Kerja list
  const unitKerjaList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.unit_kerja && e.unit_kerja !== '-' && e.unit_kerja !== 'Data Excel Belum Diimpor') {
        set.add(e.unit_kerja);
      }
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = emp.nama?.toLowerCase().includes(q);
        const matchId = emp.nomor_induk?.toLowerCase().includes(q);
        const matchNip = emp.nip?.toLowerCase().includes(q);
        const matchJabatan = emp.jabatan?.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchNip && !matchJabatan) return false;
      }

      // Unit filter
      if (selectedUnit !== 'all') {
        if (emp.unit_kerja !== selectedUnit) return false;
      }

      // Status filter
      if (selectedStatus === 'ready') {
        return emp.hasPhoto && emp.faceDescriptor && emp.faceDescriptor.length > 0;
      }
      if (selectedStatus === 'no_photo') {
        return !emp.hasPhoto;
      }
      if (selectedStatus === 'photo_no_excel') {
        return emp.extraFields?._isPhotoOnly === 'true';
      }
      if (selectedStatus === 'photo_issue') {
        return emp.photoStatus === 'no_face' || emp.photoStatus === 'error' || emp.photoStatus === 'multi_face';
      }

      return true;
    });
  }, [employees, searchQuery, selectedUnit, selectedStatus]);

  // Handle single photo upload for specific employee
  const handleSinglePhotoClick = (emp: Employee) => {
    targetEmployeeIdRef.current = emp.nomor_induk;
    fileInputRef.current?.click();
  };

  const handleSinglePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const nomorInduk = targetEmployeeIdRef.current;
    if (!file || !nomorInduk) return;

    setIsProcessingPhoto(true);
    try {
      const imgElement = await fileToImage(file);
      const result = await processEmployeePhoto(imgElement);

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
        onDataChanged();
      }
    } catch (err) {
      alert('Gagal memproses foto: ' + String(err));
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (emp: Employee) => {
    if (confirm(`Hapus data pegawai ${emp.nama} (${emp.nomor_induk}) dari database?`)) {
      await deleteEmployee(emp.nomor_induk);
      onDataChanged();
      if (selectedEmployeeDetail?.nomor_induk === emp.nomor_induk) {
        setSelectedEmployeeDetail(null);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Hidden single photo input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleSinglePhotoFile}
      />

      {/* Header controls */}
      <div className="p-5 border-b border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Database Pegawai</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan {filteredEmployees.length} dari total {employees.length} data pegawai.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIP, nomor induk..."
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter Unit Kerja */}
            <div className="relative">
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Unit Kerja</option>
                {unitKerjaList.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Status Foto */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="ready">✓ Foto Siap (Embedding)</option>
                <option value="no_photo">✗ Belum Ada Foto</option>
                <option value="photo_issue">⚠ Foto Bermasalah</option>
                <option value="photo_no_excel">Foto Tanpa Data Excel</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {isProcessingPhoto && (
        <div className="bg-blue-50 px-5 py-2.5 text-xs text-blue-800 flex items-center gap-2 border-b border-blue-200">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Memproses foto dan memperbarui embedding biometrik...</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 w-12 text-center">No</th>
              <th className="py-3 px-4 w-16">Foto</th>
              <th className="py-3 px-4">Nomor Induk</th>
              <th className="py-3 px-4">Nama Pegawai</th>
              <th className="py-3 px-4">Jabatan</th>
              <th className="py-3 px-4">Unit Kerja</th>
              <th className="py-3 px-4 text-center">Status Biometrik</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400">
                  Tidak ada data pegawai yang sesuai dengan kriteria filter.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp, idx) => (
                <tr key={emp.nomor_induk} className="hover:bg-slate-50/80 transition-colors">
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
                  <td className="py-2.5 px-4 font-mono font-semibold text-blue-700">
                    {emp.nomor_induk}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">
                    <div>{emp.nama}</div>
                    {emp.nip && emp.nip !== emp.nomor_induk && (
                      <div className="text-[11px] text-slate-400 font-mono">NIP: {emp.nip}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">
                    {emp.jabatan || '-'}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">
                    {emp.unit_kerja || '-'}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {emp.photoStatus === 'ready' && emp.faceDescriptor ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold text-[11px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Embedding Siap
                      </span>
                    ) : emp.photoStatus === 'multi_face' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-semibold text-[11px]" title={emp.photoError}>
                        <AlertTriangle className="w-3 h-3" />
                        Multi Wajah
                      </span>
                    ) : emp.photoStatus === 'no_face' || emp.photoStatus === 'error' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-semibold text-[11px]" title={emp.photoError}>
                        <XCircle className="w-3 h-3" />
                        Gagal Wajah
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium text-[11px]">
                        Tanpa Foto
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      {/* View details */}
                      <button
                        type="button"
                        onClick={() => setSelectedEmployeeDetail(emp)}
                        title="Lihat Detail"
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Upload/Replace single photo */}
                      <button
                        type="button"
                        onClick={() => handleSinglePhotoClick(emp)}
                        title="Unggah / Perbarui Foto"
                        className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDelete(emp)}
                        title="Hapus Pegawai"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployeeDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Rincian Data Pegawai</h3>
              <button
                type="button"
                onClick={() => setSelectedEmployeeDetail(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="w-20 h-24 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                {selectedEmployeeDetail.photoUrl ? (
                  <img
                    src={selectedEmployeeDetail.photoUrl}
                    alt={selectedEmployeeDetail.nama}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 text-base leading-tight">
                  {selectedEmployeeDetail.nama}
                </h4>
                <div className="mt-1 font-mono text-xs text-blue-700 font-semibold">
                  Nomor Induk: {selectedEmployeeDetail.nomor_induk}
                </div>
                {selectedEmployeeDetail.nip && (
                  <div className="font-mono text-xs text-slate-500">
                    NIP: {selectedEmployeeDetail.nip}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2.5 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-500 w-24">Jabatan:</span>
                <span className="font-semibold text-slate-900 truncate">
                  {selectedEmployeeDetail.jabatan || '-'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-500 w-24">Unit Kerja:</span>
                <span className="font-semibold text-slate-900 truncate">
                  {selectedEmployeeDetail.unit_kerja || '-'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-500 w-24">Pangkat/Gol:</span>
                <span className="font-medium text-slate-900 truncate">
                  {selectedEmployeeDetail.pangkat_golongan || '-'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-24 pl-6">Instansi:</span>
                <span className="text-slate-700 truncate">
                  {selectedEmployeeDetail.instansi || '-'}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                <span className="text-slate-500 w-24 pl-6">Embedding:</span>
                <span className="font-mono font-semibold text-emerald-700">
                  {selectedEmployeeDetail.faceDescriptor
                    ? `128 Dimensi (Siap)`
                    : 'Belum Dihasilkan'}
                </span>
              </div>
              {selectedEmployeeDetail.photoError && (
                <div className="pt-2 text-rose-700 border-t border-slate-200/60">
                  <strong>Catatan Foto:</strong> {selectedEmployeeDetail.photoError}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  handleSinglePhotoClick(selectedEmployeeDetail);
                  setSelectedEmployeeDetail(null);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Ganti Foto
              </button>
              <button
                type="button"
                onClick={() => setSelectedEmployeeDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
