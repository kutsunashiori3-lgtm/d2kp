/**
 * Employee identification result card.
 * Displays comprehensive, dynamic employee identity parsed from Master Server database & Excel.
 * Supports dynamic fields (FIELD NAME -> VALUE), multi-face indexing, and normalized status indicators.
 */
import React, { useState } from 'react';
import { Employee } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  UserX,
  Building2,
  Briefcase,
  Award,
  Search,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  User,
  GraduationCap,
  Calendar,
  MapPin,
  Mail,
  Phone,
  Layers,
  Sparkles,
  Fingerprint,
} from 'lucide-react';

export type IdentificationStatusType =
  | 'detecting'
  | 'identifying'
  | 'verified'
  | 'unknown'
  | 'low_confidence'
  | 'no_face'
  | 'recognized'
  | 'verifying'
  | 'unrecognized';

interface EmployeeCardProps {
  employee?: Employee;
  confidence?: number;
  distance?: number;
  status: IdentificationStatusType;
  consecutiveMatches?: number;
  faceIndex?: number;
  totalFaces?: number;
  compact?: boolean;
}

/**
 * Clean and format field values safely.
 * Replaces null, undefined, NaN, or whitespace-only with "-"
 */
function formatFieldValue(val: unknown): string {
  if (val === undefined || val === null) return '-';
  const str = String(val).trim();
  if (!str || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null' || str.toLowerCase() === 'nan') {
    return '-';
  }
  return str;
}

/**
 * Format confidence percentage into Indonesian locale format (e.g. 96,8%)
 */
function formatConfidence(conf: number | undefined): string {
  if (conf === undefined || isNaN(conf)) return '0,0%';
  const num = Math.min(100, Math.max(0, conf));
  return `${num.toFixed(1).replace('.', ',')}%`;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee,
  confidence = 0,
  distance = 0,
  status,
  consecutiveMatches = 0,
  faceIndex,
  totalFaces = 1,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Normalize incoming status to one of the 5 official states
  let normalizedStatus: 'no_face' | 'detecting' | 'identifying' | 'verified' | 'unknown' | 'low_confidence' = 'no_face';

  if (status === 'no_face') {
    normalizedStatus = 'no_face';
  } else if (status === 'detecting') {
    normalizedStatus = 'detecting';
  } else if (status === 'verifying' || status === 'identifying') {
    normalizedStatus = 'identifying';
  } else if (status === 'recognized' || status === 'verified') {
    normalizedStatus = 'verified';
  } else if (status === 'low_confidence') {
    normalizedStatus = 'low_confidence';
  } else if (status === 'unrecognized' || status === 'unknown') {
    // If confidence score is moderately high (> 35%) but didn't pass threshold, classify as LOW CONFIDENCE
    if (confidence > 35 && confidence < 75) {
      normalizedStatus = 'low_confidence';
    } else {
      normalizedStatus = 'unknown';
    }
  }

  // 1. NO FACE DETECTED
  if (normalizedStatus === 'no_face') {
    return (
      <div
        id="result-panel-no-face"
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center transition-all"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-400 mb-3">
          <UserX className="w-7 h-7" />
        </div>
        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
          Status: Standby
        </span>
        <h4 className="text-base font-bold text-slate-800">Tidak Ada Wajah Terdeteksi</h4>
        <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
          Posisikan wajah Anda tepat di depan kamera dalam jarak 0.5 – 1.5 meter dengan pencahayaan yang cukup.
        </p>
      </div>
    );
  }

  // 2. DETECTING (Wajah terdeteksi, mulai diproses)
  if (normalizedStatus === 'detecting') {
    return (
      <div
        id="result-panel-detecting"
        className="bg-sky-50/80 rounded-2xl border border-sky-200/90 shadow-sm p-6 text-center transition-all animate-pulse"
      >
        <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 mb-3">
          <Search className="w-6 h-6 animate-spin" />
        </div>
        <span className="inline-block px-3 py-0.5 bg-sky-100 text-sky-800 rounded-full text-xs font-semibold uppercase tracking-wider mb-1.5">
          1. DETECTING
        </span>
        <h4 className="text-base font-bold text-sky-950">Mendeteksi Wajah...</h4>
        <p className="text-xs text-sky-700 mt-1">
          Kamera menemukan kontur wajah, mengarahkan detektor biometrik.
        </p>
      </div>
    );
  }

  // 3. IDENTIFYING (Mencari kecocokan / Verifikasi frame temporal)
  if (normalizedStatus === 'identifying') {
    return (
      <div
        id="result-panel-identifying"
        className="bg-amber-50/90 rounded-2xl border-2 border-amber-300/80 shadow-md p-6 text-center transition-all"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 mb-3 relative">
          <Fingerprint className="w-7 h-7 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-amber-100 text-amber-900 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
          <span>2. IDENTIFYING</span>
          {consecutiveMatches > 0 && <span>({consecutiveMatches}/3 frame)</span>}
        </div>
        <h4 className="text-base font-bold text-amber-950">Mencari Kecocokan...</h4>
        <p className="text-xs text-amber-800 mt-1 max-w-xs mx-auto">
          {employee?.nama
            ? `Memverifikasi identitas untuk ${employee.nama}. Tahan posisi wajah Anda sejenak.`
            : 'Mencocokkan vektor embedding biometrik dengan database server...'}
        </p>
        <div className="mt-4 w-full bg-amber-200/70 h-2 rounded-full overflow-hidden">
          <div
            className="bg-amber-500 h-full rounded-full transition-all duration-200"
            style={{ width: `${Math.min(100, Math.max(25, (consecutiveMatches / 3) * 100))}%` }}
          />
        </div>
      </div>
    );
  }

  // 4. LOW CONFIDENCE (Kecocokan tidak mencukupi)
  if (normalizedStatus === 'low_confidence') {
    return (
      <div
        id="result-panel-low-confidence"
        className="bg-amber-50/90 rounded-2xl border border-amber-300 shadow-sm p-6 text-center"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 mb-3">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <span className="inline-block px-3 py-0.5 bg-amber-100 text-amber-900 rounded-full text-xs font-bold uppercase tracking-wider mb-1.5">
          5. LOW CONFIDENCE
        </span>
        <h4 className="text-base font-bold text-amber-950">Kecocokan Tidak Mencukupi</h4>
        <p className="text-xs text-amber-800 mt-1 max-w-xs mx-auto">
          Tingkat kemiripan wajah di bawah ambang batas (threshold). Pastikan wajah tidak tertutup masker, kacamata hitam, atau pencahayaan terlalu gelap.
        </p>
        <div className="mt-3.5 inline-flex items-center gap-3 px-3.5 py-1.5 bg-white rounded-xl text-xs font-mono text-amber-900 border border-amber-200 shadow-xs">
          <span>Kecocokan: <strong>{formatConfidence(confidence)}</strong></span>
          <span className="text-amber-300">|</span>
          <span>Jarak: <strong>{distance.toFixed(4)}</strong></span>
        </div>
      </div>
    );
  }

  // 5. UNKNOWN (Wajah belum dikenali)
  if (normalizedStatus === 'unknown' || !employee) {
    return (
      <div
        id="result-panel-unknown"
        className="bg-rose-50/90 rounded-2xl border border-rose-200 shadow-sm p-6 text-center"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 mb-3">
          <HelpCircle className="w-7 h-7" />
        </div>
        <span className="inline-block px-3 py-0.5 bg-rose-100 text-rose-800 rounded-full text-xs font-bold uppercase tracking-wider mb-1.5">
          4. UNKNOWN
        </span>
        <h4 className="text-base font-bold text-rose-950">Wajah Belum Dikenali</h4>
        <p className="text-xs text-rose-800 mt-1 max-w-xs mx-auto">
          Wajah terdeteksi oleh kamera, namun tidak ditemukan kecocokan dengan foto pegawai yang tersimpan pada Master Server.
        </p>
        <div className="mt-3.5 inline-flex items-center gap-3 px-3.5 py-1.5 bg-white rounded-xl text-xs font-mono text-slate-700 border border-rose-200 shadow-xs">
          <span>Skor Kecocokan: <strong className="text-rose-600">{formatConfidence(confidence)}</strong></span>
          <span className="text-slate-300">|</span>
          <span>Status: <strong className="text-rose-700 uppercase">Unknown</strong></span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 6. VERIFIED (Wajah dikenali) - FULL COMPREHENSIVE IDENTITY DISPLAY
  // =========================================================================
  const extraFields = employee.extraFields || {};

  // Extract core known attributes or lookup from extraFields dynamically
  const nipValue = formatFieldValue(employee.nip || employee.nomor_induk);
  const namaValue = formatFieldValue(employee.nama);
  const nomorIndukValue = formatFieldValue(employee.nomor_induk);
  const jabatanValue = formatFieldValue(employee.jabatan);
  const unitKerjaValue = formatFieldValue(employee.unit_kerja);
  const instansiValue = formatFieldValue(employee.instansi);
  const pangkatGolValue = formatFieldValue(employee.pangkat_golongan);

  // Check extra fields with flexible key matchers
  const findExtra = (patterns: string[]): string | undefined => {
    for (const [k, v] of Object.entries(extraFields)) {
      const cleanK = k.toLowerCase().replace(/[_\s\-\/]/g, '');
      for (const p of patterns) {
        const cleanP = p.toLowerCase().replace(/[_\s\-\/]/g, '');
        if (cleanK === cleanP || cleanK.includes(cleanP) || cleanP.includes(cleanK)) {
          return formatFieldValue(v);
        }
      }
    }
    return undefined;
  };

  const tempatLahir = findExtra(['tempat lahir', 'tempatlahir', 'tmplahir', 'kota lahir']);
  const tanggalLahir = findExtra(['tanggal lahir', 'tanggallahir', 'tgllahir', 'tgl lahir']);
  const jenisKelamin = findExtra(['jenis kelamin', 'jeniskelamin', 'gender', 'jk', 'sex']);
  const pendidikan = findExtra(['pendidikan', 'jenjang', 'pendidikan terakhir']);
  const statusKepegawaian = findExtra([
    'status kepegawaian',
    'status',
    'status pegawai',
    'kedudukan',
    'kepegawaian',
  ]);
  const email = findExtra(['email', 'surel', 'e-mail']);
  const nomorHp = findExtra(['nomor hp', 'no hp', 'hp', 'telepon', 'whatsapp', 'wa', 'no telp']);
  const alamat = findExtra(['alamat', 'domisili', 'alamat rumah']);

  // Collect any OTHER remaining dynamic fields not covered above
  const standardKeyCheck = (key: string) => {
    const k = key.toLowerCase().replace(/[_\s\-\/]/g, '');
    const standardKeys = [
      'nomorinduk',
      'noinduk',
      'nip',
      'nama',
      'namalengkap',
      'jabatan',
      'unitkerja',
      'instansi',
      'pangkatgolongan',
      'pangkat',
      'golongan',
      'tempatlahir',
      'tanggallahir',
      'jeniskelamin',
      'gender',
      'pendidikan',
      'statuskepegawaian',
      'status',
      'email',
      'nomorhp',
      'nohp',
      'telepon',
      'alamat',
    ];
    return standardKeys.some((s) => k === s || k.includes(s));
  };

  const remainingCustomFields: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(extraFields)) {
    if (!standardKeyCheck(k)) {
      const valStr = formatFieldValue(v);
      if (valStr !== '-') {
        remainingCustomFields.push({ key: k, value: valStr });
      }
    }
  }

  return (
    <div
      id={`employee-card-verified-${employee.nomor_induk}`}
      className="bg-white rounded-2xl border-2 border-emerald-500/40 shadow-xl shadow-emerald-950/5 overflow-hidden transition-all duration-300 flex flex-col"
    >
      {/* 1. Header Banner: ✓ WAJAH DIKENALI */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 py-3 text-white flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-100" />
          </span>
          <span className="font-bold text-sm tracking-wide uppercase">✓ WAJAH DIKENALI</span>
        </div>

        <div className="flex items-center gap-2">
          {faceIndex !== undefined && (
            <span className="px-2 py-0.5 bg-black/20 text-emerald-100 rounded-md text-[11px] font-mono font-semibold">
              Wajah {faceIndex + 1}
              {totalFaces > 1 ? ` dari ${totalFaces}` : ''}
            </span>
          )}
          <span className="px-2.5 py-0.5 bg-white/25 rounded-full text-xs font-mono font-bold tracking-tight">
            VERIFIED
          </span>
        </div>
      </div>

      {/* 2. Top Profile Hero: [ FOTO PEGAWAI ] & Primary Identitas */}
      <div className="p-5 pb-4 bg-slate-50/70 border-b border-slate-200/80">
        <div className="flex flex-col items-center text-center">
          {/* FOTO DATABASE PEGAWAI (Gunakan foto database pegawai, bukan screenshot webcam) */}
          <div className="relative group mb-3">
            <div className="w-28 h-36 sm:w-32 sm:h-40 rounded-xl bg-white border-2 border-emerald-500 shadow-md overflow-hidden flex items-center justify-center p-0.5">
              {employee.photoUrl ? (
                <img
                  src={employee.photoUrl}
                  alt={`Foto Database Pegawai: ${employee.nama}`}
                  className="w-full h-full object-cover rounded-lg"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 p-2">
                  <User className="w-10 h-10 mb-1 text-slate-300" />
                  <span className="text-[10px] text-center font-medium leading-tight">Foto Database Belum Tersedia</span>
                </div>
              )}
            </div>

            {/* Verified badge pin */}
            <div
              title="Foto database pegawai terverifikasi biometrik"
              className="absolute -bottom-2 -right-2 bg-emerald-600 text-white rounded-full p-1.5 shadow-md border-2 border-white flex items-center justify-center"
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Foto Database Pegawai
          </span>

          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight uppercase">
            {namaValue}
          </h3>

          <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-full text-xs font-mono font-bold">
            <span>Nomor Induk:</span>
            <span>{nomorIndukValue}</span>
          </div>
        </div>
      </div>

      {/* 3. Detailed Identity Fields: Tabular Key -> Value layout */}
      <div className="p-5 space-y-4 flex-1">
        {/* SECTION A: IDENTITAS DASAR */}
        <div>
          <div className="flex items-center justify-between pb-1.5 mb-2.5 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Identitas Pegawai
            </span>
          </div>

          <div className="grid grid-cols-1 gap-y-2 text-xs">
            <div className="flex items-start justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium w-36 shrink-0">NIP</span>
              <span className="font-mono font-semibold text-slate-900 text-right">{nipValue}</span>
            </div>

            <div className="flex items-start justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium w-36 shrink-0">Nama Lengkap</span>
              <span className="font-semibold text-slate-900 text-right">{namaValue}</span>
            </div>

            {tempatLahir && (
              <div className="flex items-start justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium w-36 shrink-0">Tempat Lahir</span>
                <span className="font-semibold text-slate-800 text-right">{tempatLahir}</span>
              </div>
            )}

            {tanggalLahir && (
              <div className="flex items-start justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium w-36 shrink-0">Tanggal Lahir</span>
                <span className="font-semibold text-slate-800 text-right">{tanggalLahir}</span>
              </div>
            )}

            {jenisKelamin && (
              <div className="flex items-start justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium w-36 shrink-0">Jenis Kelamin</span>
                <span className="font-semibold text-slate-800 text-right">{jenisKelamin}</span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION B: KEPEGAWAIAN, JABATAN & UNIT KERJA */}
        <div>
          <div className="flex items-center justify-between pb-1.5 mb-2.5 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
              Kepegawaian & Jabatan
            </span>
          </div>

          <div className="grid grid-cols-1 gap-y-2 text-xs">
            <div className="flex items-start justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium w-36 shrink-0">Pangkat/Golongan</span>
              <span className="font-semibold text-slate-900 text-right">{pangkatGolValue}</span>
            </div>

            <div className="flex items-start justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium w-36 shrink-0">Jabatan</span>
              <span className="font-semibold text-slate-900 text-right">{jabatanValue}</span>
            </div>

            <div className="flex items-start justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium w-36 shrink-0">Unit Kerja</span>
              <span className="font-semibold text-slate-900 text-right">{unitKerjaValue}</span>
            </div>

            <div className="flex items-start justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium w-36 shrink-0">Instansi</span>
              <span className="font-semibold text-slate-800 text-right">{instansiValue}</span>
            </div>

            {pendidikan && (
              <div className="flex items-start justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium w-36 shrink-0">Pendidikan</span>
                <span className="font-semibold text-slate-800 text-right">{pendidikan}</span>
              </div>
            )}

            {statusKepegawaian && (
              <div className="flex items-start justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium w-36 shrink-0">Status Kepegawaian</span>
                <span className="font-semibold text-emerald-700 text-right">{statusKepegawaian}</span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION C: KONTAK & DATA LAINNYA (Dinamis dari Excel) */}
        {(email || nomorHp || alamat || remainingCustomFields.length > 0) && (
          <div>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between pb-1.5 mb-2.5 border-b border-slate-200 text-left cursor-pointer group"
            >
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 group-hover:text-blue-600 transition-colors">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                Kontak & Kolom Tambahan Excel
                <span className="text-[10px] text-slate-400 font-normal">
                  ({(email ? 1 : 0) + (nomorHp ? 1 : 0) + (alamat ? 1 : 0) + remainingCustomFields.length})
                </span>
              </span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
              )}
            </button>

            {isExpanded && (
              <div className="grid grid-cols-1 gap-y-2 text-xs transition-all">
                {email && (
                  <div className="flex items-start justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium w-36 shrink-0 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" /> Email
                    </span>
                    <span className="font-mono text-slate-800 text-right truncate max-w-[200px]">{email}</span>
                  </div>
                )}

                {nomorHp && (
                  <div className="flex items-start justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium w-36 shrink-0 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" /> Nomor HP
                    </span>
                    <span className="font-mono font-semibold text-slate-800 text-right">{nomorHp}</span>
                  </div>
                )}

                {alamat && (
                  <div className="flex items-start justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium w-36 shrink-0 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" /> Alamat
                    </span>
                    <span className="font-medium text-slate-800 text-right max-w-[200px]">{alamat}</span>
                  </div>
                )}

                {/* Iterate dynamically over any novel columns added in the Excel file */}
                {remainingCustomFields.map((field, idx) => (
                  <div key={idx} className="flex items-start justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium w-36 shrink-0">{field.key}</span>
                    <span className="font-semibold text-slate-800 text-right">{field.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Bottom Metric Strip: Kecocokan Wajah & Status VERIFIED */}
        <div className="pt-3 border-t-2 border-slate-100 mt-2">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div>
              <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Kecocokan Wajah
              </span>
              <span className="text-base sm:text-lg font-mono font-extrabold text-emerald-700">
                {formatConfidence(confidence)}
              </span>
            </div>

            <div className="text-right">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-xs font-bold uppercase tracking-wide">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                VERIFIED
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
