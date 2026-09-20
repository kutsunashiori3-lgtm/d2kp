/**
 * Excel Parser service using SheetJS/xlsx
 * Strictly enforces String representation for Nomor Induk and flexible header mapping.
 */
import * as XLSX from 'xlsx';
import { Employee, ExcelColumnMapping, RecognitionLog } from '../types';
import { normalizeEmployeeId } from '../utils/normalizeEmployeeId';

export interface ParseExcelResult {
  headers: string[];
  suggestedMapping: ExcelColumnMapping;
  totalRows: number;
  rawRows: Record<string, unknown>[];
}

/**
 * Read Excel file and return available sheet headers and raw rows
 */
export async function inspectExcelFile(file: File): Promise<ParseExcelResult> {
  const arrayBuffer = await file.arrayBuffer();
  // cellText: true ensures string representation rather than scientific notation
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, cellText: true });
  
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Excel tidak memiliki sheet yang valid.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  
  // Read as raw json with raw: false to get formatted strings
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    raw: false,
    defval: '',
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('File Excel kosong atau tidak memiliki data.');
  }

  const headers = Object.keys(rawRows[0] || {});
  if (headers.length === 0) {
    throw new Error('Tidak dapat menemukan header kolom pada file Excel.');
  }

  const suggestedMapping = detectColumnMapping(headers);

  return {
    headers,
    suggestedMapping,
    totalRows: rawRows.length,
    rawRows,
  };
}

/**
 * Auto-detect column headers based on common Indonesian terms
 */
export function detectColumnMapping(headers: string[]): ExcelColumnMapping {
  const findMatch = (patterns: string[]): string => {
    for (const h of headers) {
      const cleanH = h.toLowerCase().trim().replace(/[_\s\-\/]/g, '');
      for (const p of patterns) {
        const cleanP = p.toLowerCase().trim().replace(/[_\s\-\/]/g, '');
        if (cleanH === cleanP || cleanH.includes(cleanP) || cleanP.includes(cleanH)) {
          return h;
        }
      }
    }
    return '';
  };

  const nomorIndukHeader = findMatch([
    'nomor induk',
    'no induk',
    'nomorinduk',
    'id pegawai',
    'id',
    'nip',
    'nik',
  ]);

  const namaHeader = findMatch([
    'nama pegawai',
    'nama lengkap',
    'nama',
    'pegawai',
    'name',
  ]);

  const nipHeader = findMatch(['nip', 'nomor induk pegawai', 'no nip']);
  const jabatanHeader = findMatch(['jabatan', 'posisi', 'jabatan fungsional', 'jabatan struktural']);
  const pangkatHeader = findMatch(['pangkat/golongan', 'pangkat', 'golongan', 'golongan ruang', 'pangkat golongan']);
  const unitKerjaHeader = findMatch(['unit kerja', 'unit', 'divisi', 'bagian', 'skpd', 'opd', 'biro', 'bidang']);
  const instansiHeader = findMatch(['instansi', 'organisasi', 'lembaga', 'pemerintah daerah', 'kantor']);

  return {
    nomor_induk: nomorIndukHeader || headers[0] || '',
    nama: namaHeader || (headers.length > 1 ? headers[1] : ''),
    nip: nipHeader,
    jabatan: jabatanHeader,
    pangkat_golongan: pangkatHeader,
    unit_kerja: unitKerjaHeader,
    instansi: instansiHeader,
  };
}

/**
 * Convert raw rows into typed Employee records using specified mapping
 */
export function extractEmployeesFromRawRows(
  rawRows: Record<string, unknown>[],
  mapping: ExcelColumnMapping,
  existingEmployeesMap: Map<string, Employee> = new Map()
): { employees: Employee[]; skippedCount: number; errors: string[] } {
  const employees: Employee[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  if (!mapping.nomor_induk) {
    throw new Error('Kolom "Nomor Induk" wajib ditentukan.');
  }

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rawId = row[mapping.nomor_induk];
    const nomor_induk = normalizeEmployeeId(rawId);

    if (!nomor_induk) {
      skippedCount++;
      continue;
    }

    const rawNama = mapping.nama ? String(row[mapping.nama] || '').trim() : '';
    const rawNip = mapping.nip ? normalizeEmployeeId(row[mapping.nip]) : nomor_induk;
    const rawJabatan = mapping.jabatan ? String(row[mapping.jabatan] || '').trim() : '';
    const rawPangkat = mapping.pangkat_golongan ? String(row[mapping.pangkat_golongan] || '').trim() : '';
    const rawUnitKerja = mapping.unit_kerja ? String(row[mapping.unit_kerja] || '').trim() : '';
    const rawInstansi = mapping.instansi ? String(row[mapping.instansi] || '').trim() : '';

    // Check if employee already exists in existing map (e.g. from photo import)
    const existing = existingEmployeesMap.get(nomor_induk);

    const emp: Employee = {
      nomor_induk,
      nama: rawNama || existing?.nama || `Pegawai ${nomor_induk}`,
      nip: rawNip || existing?.nip || nomor_induk,
      jabatan: rawJabatan || existing?.jabatan || '-',
      pangkat_golongan: rawPangkat || existing?.pangkat_golongan || '-',
      unit_kerja: rawUnitKerja || existing?.unit_kerja || '-',
      instansi: rawInstansi || existing?.instansi || '-',
      hasPhoto: existing?.hasPhoto ?? false,
      photoFileName: existing?.photoFileName,
      photoUrl: existing?.photoUrl,
      faceDescriptor: existing?.faceDescriptor,
      photoStatus: existing?.photoStatus ?? 'no_photo',
      photoError: existing?.photoError,
      extraFields: {},
      updatedAt: Date.now(),
    };

    employees.push(emp);
  }

  return { employees, skippedCount, errors };
}

/**
 * Generate and trigger download of template / demo Excel file
 */
export function generateSampleExcelFile(): void {
  const sampleData = [
    {
      'Nomor Induk': '198701012010011001',
      'Nama': 'Ahmad Fauzi, S.Kom',
      'NIP': '198701012010011001',
      'Pangkat/Golongan': 'III/c - Penata',
      'Jabatan': 'Analis Kepegawaian Muda',
      'Unit Kerja': 'BKPSDM',
      'Instansi': 'Pemerintah Kabupaten',
    },
    {
      'Nomor Induk': '198802152011021002',
      'Nama': 'Budi Santoso, S.E.',
      'NIP': '198802152011021002',
      'Pangkat/Golongan': 'III/b - Penata Muda Tk. I',
      'Jabatan': 'Pengadministrasi Keuangan',
      'Unit Kerja': 'BKAD',
      'Instansi': 'Pemerintah Kabupaten',
    },
    {
      'Nomor Induk': '199003102012032003',
      'Nama': 'Siti Nurhaliza, M.Pd',
      'NIP': '199003102012032003',
      'Pangkat/Golongan': 'III/d - Penata Tk. I',
      'Jabatan': 'Pranata Komputer Ahli Muda',
      'Unit Kerja': 'Dinas Komunikasi dan Informatika',
      'Instansi': 'Pemerintah Kabupaten',
    },
    {
      'Nomor Induk': '199105202013041004',
      'Nama': 'Dedi Kusuma, S.Sos',
      'NIP': '199105202013041004',
      'Pangkat/Golongan': 'III/a - Penata Muda',
      'Jabatan': 'Pengelola Data Informasi',
      'Unit Kerja': 'Inspektorat Daerah',
      'Instansi': 'Pemerintah Kabupaten',
    },
    {
      'Nomor Induk': '199308142014022005',
      'Nama': 'Rina Wulandari, S.H.',
      'NIP': '199308142014022005',
      'Pangkat/Golongan': 'III/b - Penata Muda Tk. I',
      'Jabatan': 'Analis Hukum & Tata Laksana',
      'Unit Kerja': 'Sekretariat Daerah',
      'Instansi': 'Pemerintah Kabupaten',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pegawai');

  XLSX.writeFile(workbook, 'pegawai_sample_template.xlsx');
}

/**
 * Export recognition logs to Excel (.xlsx)
 */
export function exportLogsToExcel(logs: RecognitionLog[]): void {
  const exportData = logs.map((log, i) => ({
    'No': i + 1,
    'Tanggal': log.dateStr,
    'Waktu': log.timeStr,
    'Nomor Induk': log.nomor_induk,
    'Nama': log.nama,
    'NIP': log.nip || log.nomor_induk,
    'Jabatan': log.jabatan || '-',
    'Unit Kerja': log.unit_kerja,
    'Instansi': log.instansi || '-',
    'Tingkat Kecocokan': `${log.confidence}%`,
    'Status': log.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Pengenalan');

  const now = new Date();
  const dateSuffix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  XLSX.writeFile(workbook, `riwayat_presensi_wajah_${dateSuffix}.xlsx`);
}
