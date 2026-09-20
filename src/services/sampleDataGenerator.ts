/**
 * Sample dataset generator to test without needing external files immediately.
 */
import { Employee } from '../types';
import { generateInitialsAvatar } from './imageProcessor';

export const SAMPLE_EMPLOYEES: Omit<Employee, 'faceDescriptor' | 'hasPhoto' | 'photoStatus' | 'updatedAt'>[] = [
  {
    nomor_induk: '198701012010011001',
    nama: 'Ahmad Fauzi, S.Kom',
    nip: '198701012010011001',
    jabatan: 'Analis Kepegawaian Ahli Muda',
    pangkat_golongan: 'III/c - Penata',
    unit_kerja: 'BKPSDM',
    instansi: 'Pemerintah Kabupaten',
  },
  {
    nomor_induk: '198802152011021002',
    nama: 'Budi Santoso, S.E.',
    nip: '198802152011021002',
    jabatan: 'Pengadministrasi Keuangan',
    pangkat_golongan: 'III/b - Penata Muda Tk. I',
    unit_kerja: 'BKAD',
    instansi: 'Pemerintah Kabupaten',
  },
  {
    nomor_induk: '199003102012032003',
    nama: 'Siti Nurhaliza, M.Pd',
    nip: '199003102012032003',
    jabatan: 'Pranata Komputer Ahli Muda',
    pangkat_golongan: 'III/d - Penata Tk. I',
    unit_kerja: 'Dinas Komunikasi dan Informatika',
    instansi: 'Pemerintah Kabupaten',
  },
  {
    nomor_induk: '199105202013041004',
    nama: 'Dedi Kusuma, S.Sos',
    nip: '199105202013041004',
    jabatan: 'Pengelola Data Informasi',
    pangkat_golongan: 'III/a - Penata Muda',
    unit_kerja: 'Inspektorat Daerah',
    instansi: 'Pemerintah Kabupaten',
  },
  {
    nomor_induk: '199308142014022005',
    nama: 'Rina Wulandari, S.H.',
    nip: '199308142014022005',
    jabatan: 'Analis Hukum & Tata Laksana',
    pangkat_golongan: 'III/b - Penata Muda Tk. I',
    unit_kerja: 'Sekretariat Daerah',
    instansi: 'Pemerintah Kabupaten',
  },
];

export function getSampleEmployeesWithAvatars(): Employee[] {
  const now = Date.now();
  return SAMPLE_EMPLOYEES.map(emp => ({
    ...emp,
    hasPhoto: true,
    photoFileName: `${emp.nomor_induk}.jpg`,
    photoUrl: generateInitialsAvatar(emp.nama, emp.nomor_induk),
    photoStatus: 'ready',
    updatedAt: now,
  }));
}
