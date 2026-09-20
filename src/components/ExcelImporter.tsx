/**
 * Excel Importer component supporting .xlsx and .xls with automatic header detection,
 * column mapping dropdowns, preview table, and template download.
 */
import React, { useState, useRef } from 'react';
import { Employee, ExcelColumnMapping } from '../types';
import {
  inspectExcelFile,
  extractEmployeesFromRawRows,
  generateSampleExcelFile,
  ParseExcelResult,
} from '../services/excelParser';
import { saveEmployees, getAllEmployees } from '../services/database';
import { uploadExcelToServer } from '../services/serverDbService';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  Eye,
  RefreshCw,
} from 'lucide-react';

interface ExcelImporterProps {
  onSuccess: (importedCount: number) => void;
}

export const ExcelImporter: React.FC<ExcelImporterProps> = ({ onSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseExcelResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ExcelColumnMapping>({
    nomor_induk: '',
    nama: '',
    nip: '',
    jabatan: '',
    pangkat_golongan: '',
    unit_kerja: '',
    instansi: '',
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const handleFileChange = async (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrorMessage('Format file harus berupa Excel (.xlsx atau .xls).');
      return;
    }

    setErrorMessage(null);
    setSuccessInfo(null);
    setSelectedFile(file);
    setIsInspecting(true);

    try {
      const result = await inspectExcelFile(file);
      setParseResult(result);
      setColumnMapping(result.suggestedMapping);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal membaca file Excel.');
      setParseResult(null);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleMappingChange = (field: keyof ExcelColumnMapping, value: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCommitImport = async () => {
    if (!parseResult || !columnMapping.nomor_induk) {
      setErrorMessage('Kolom "Nomor Induk" wajib ditentukan!');
      return;
    }
    if (!columnMapping.nama) {
      setErrorMessage('Kolom "Nama" wajib ditentukan!');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // Fetch existing employees to preserve photos/embeddings
      const existing = await getAllEmployees();
      const existingMap = new Map<string, Employee>();
      existing.forEach((e) => existingMap.set(e.nomor_induk, e));

      const { employees, skippedCount } = extractEmployeesFromRawRows(
        parseResult.rawRows,
        columnMapping,
        existingMap
      );

      await saveEmployees(employees);

      // Save to Master Server storage permanently
      let serverSaved = false;
      if (selectedFile) {
        const sRes = await uploadExcelToServer(selectedFile, employees);
        serverSaved = sRes.success;
      }

      setSuccessInfo(
        `Berhasil mengimpor ${employees.length} data pegawai ke database!` +
          (skippedCount > 0 ? ` (${skippedCount} baris kosong dilewati).` : '') +
          (serverSaved ? ' Data tersimpan permanen di Master Server.' : '')
      );

      onSuccess(employees.length);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal menyimpan data pegawai.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Import Database Identitas Pegawai (Excel)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Unggah berkas Excel (.xlsx / .xls) berisi data identitas pegawai. Nomor Induk akan dijadikan Kunci Utama (Primary Key).
          </p>
        </div>

        <button
          type="button"
          onClick={() => generateSampleExcelFile()}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          Unduh Template Excel
        </button>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          selectedFile
            ? 'border-emerald-300 bg-emerald-50/40'
            : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileChange(e.target.files[0]);
            }
          }}
        />

        <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center mx-auto text-emerald-600 mb-3">
          <Upload className="w-6 h-6" />
        </div>

        {selectedFile ? (
          <div>
            <span className="font-semibold text-sm text-slate-900">{selectedFile.name}</span>
            <span className="text-xs text-slate-500 block mt-0.5">
              {(selectedFile.size / 1024).toFixed(1)} KB — Klik atau seret file lain untuk mengganti
            </span>
          </div>
        ) : (
          <div>
            <span className="font-semibold text-sm text-slate-800">
              Pilih atau Seret File Excel (pegawai.xlsx) ke sini
            </span>
            <span className="text-xs text-slate-500 block mt-1">
              Mendukung format Microsoft Excel .XLSX dan .XLS
            </span>
          </div>
        )}
      </div>

      {/* Feedback Messages */}
      {errorMessage && (
        <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successInfo && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successInfo}</span>
        </div>
      )}

      {/* Column Mapping Section */}
      {parseResult && (
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>Pemetaan Kolom Excel (Column Mapping)</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] rounded-full font-semibold">
                  {parseResult.totalRows} Baris Terdeteksi
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pastikan nama kolom Excel terhubung ke atribut pegawai yang sesuai.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* Nomor Induk (Primary Key) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor Induk <span className="text-rose-500">* (Wajib / PK)</span>
              </label>
              <select
                value={columnMapping.nomor_induk}
                onChange={(e) => handleMappingChange('nomor_induk', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 font-mono"
              >
                <option value="">-- Pilih Kolom --</option>
                {parseResult.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Nama */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Pegawai <span className="text-rose-500">* (Wajib)</span>
              </label>
              <select
                value={columnMapping.nama}
                onChange={(e) => handleMappingChange('nama', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Pilih Kolom --</option>
                {parseResult.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* NIP */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NIP (Opsional)
              </label>
              <select
                value={columnMapping.nip || ''}
                onChange={(e) => handleMappingChange('nip', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Samakan dengan Nomor Induk --</option>
                {parseResult.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Jabatan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jabatan
              </label>
              <select
                value={columnMapping.jabatan || ''}
                onChange={(e) => handleMappingChange('jabatan', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Tidak Dipetakan --</option>
                {parseResult.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Kerja */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit Kerja
              </label>
              <select
                value={columnMapping.unit_kerja || ''}
                onChange={(e) => handleMappingChange('unit_kerja', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Tidak Dipetakan --</option>
                {parseResult.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Pangkat / Golongan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pangkat / Golongan
              </label>
              <select
                value={columnMapping.pangkat_golongan || ''}
                onChange={(e) => handleMappingChange('pangkat_golongan', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Tidak Dipetakan --</option>
                {parseResult.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Instansi */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Instansi
              </label>
              <select
                value={columnMapping.instansi || ''}
                onChange={(e) => handleMappingChange('instansi', e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Tidak Dipetakan --</option>
                {parseResult.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview First 5 Rows */}
          <div className="mt-5">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              Pratinjau Data (5 Baris Pertama):
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Nomor Induk (PK)</th>
                    <th className="py-2.5 px-3">Nama Pegawai</th>
                    <th className="py-2.5 px-3">NIP</th>
                    <th className="py-2.5 px-3">Jabatan</th>
                    <th className="py-2.5 px-3">Unit Kerja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parseResult.rawRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-semibold text-blue-700">
                        {String(row[columnMapping.nomor_induk] || '-')}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {String(row[columnMapping.nama] || '-')}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {String((columnMapping.nip && row[columnMapping.nip]) || row[columnMapping.nomor_induk] || '-')}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {String((columnMapping.jabatan && row[columnMapping.jabatan]) || '-')}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {String((columnMapping.unit_kerja && row[columnMapping.unit_kerja]) || '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCommitImport}
              disabled={isSaving || !columnMapping.nomor_induk || !columnMapping.nama}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Menyimpan ke Database...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan & Hubungkan Data ({parseResult.totalRows} Pegawai)
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
