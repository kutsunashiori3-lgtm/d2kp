/**
 * Employee identification result card.
 */
import React from 'react';
import { Employee } from '../types';
import { CheckCircle2, AlertTriangle, ShieldCheck, UserX, Building2, Briefcase, Award } from 'lucide-react';

interface EmployeeCardProps {
  employee?: Employee;
  confidence?: number;
  distance?: number;
  status: 'recognized' | 'verifying' | 'unrecognized' | 'no_face';
  consecutiveMatches?: number;
  compact?: boolean;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee,
  confidence = 0,
  distance = 0,
  status,
  consecutiveMatches = 0,
  compact = false,
}) => {
  if (status === 'no_face') {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center ${compact ? 'py-4' : ''}`}>
        <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <UserX className="w-7 h-7" />
        </div>
        <h4 className="text-base font-semibold text-slate-800">Tidak Ada Wajah Terdeteksi</h4>
        <p className="text-xs text-slate-500 mt-1">
          Arahkan wajah pegawai tegak lurus ke arah kamera dengan pencahayaan memadai.
        </p>
      </div>
    );
  }

  if (status === 'verifying') {
    return (
      <div className="bg-amber-50/90 rounded-xl border border-amber-200/80 shadow-sm p-5 text-center transition-all animate-pulse">
        <div className="flex items-center justify-center gap-2 text-amber-700 font-semibold mb-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
          <span>Memverifikasi Wajah ({consecutiveMatches}/3 frame)...</span>
        </div>
        <p className="text-xs text-amber-800">
          Tahan posisi wajah Anda sejenak untuk konfirmasi identitas stabil.
        </p>
      </div>
    );
  }

  if (status === 'unrecognized' || !employee) {
    return (
      <div className="bg-rose-50 rounded-xl border border-rose-200 shadow-sm p-5 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-2">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-rose-800 uppercase tracking-wide">Wajah Belum Dikenali</h4>
        <p className="text-xs text-rose-700 mt-1">
          Wajah terdeteksi namun tidak cocok dengan data foto pegawai yang terdaftar pada database.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white rounded-md text-xs font-mono text-slate-600 border border-rose-200">
          <span>Skor Kecocokan:</span>
          <span className="font-semibold text-rose-600">{confidence}%</span>
          <span className="text-slate-400">|</span>
          <span>Jarak: {distance}</span>
        </div>
      </div>
    );
  }

  // Recognized Employee
  return (
    <div className="bg-white rounded-xl border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/5 overflow-hidden transition-all duration-300">
      {/* Header status strip */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2.5 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-200" />
          <span className="text-xs font-bold uppercase tracking-wider">Identitas Terkonfirmasi</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-xs">
          <span>Kecocokan:</span>
          <span className="font-mono">{confidence}%</span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          {/* Employee Photo Thumbnail */}
          <div className="relative shrink-0">
            <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-lg bg-slate-100 border-2 border-slate-200 overflow-hidden shadow-inner flex items-center justify-center">
              {employee.photoUrl ? (
                <img
                  src={employee.photoUrl}
                  alt={employee.nama}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-slate-400 text-xs text-center p-2">
                  Tanpa Foto Database
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white rounded-full p-1 shadow-md">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h3 className="text-lg font-bold text-slate-900 leading-tight truncate">
              {employee.nama}
            </h3>

            <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-xs font-mono font-semibold rounded border border-blue-200">
                Nomor Induk: {employee.nomor_induk}
              </span>
              {employee.nip && employee.nip !== employee.nomor_induk && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-mono rounded">
                  NIP: {employee.nip}
                </span>
              )}
            </div>

            <div className="mt-3.5 space-y-1.5 text-xs text-slate-700 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 font-medium shrink-0">Jabatan:</span>
                <span className="font-semibold text-slate-800 truncate">{employee.jabatan || '-'}</span>
              </div>

              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 font-medium shrink-0">Unit Kerja:</span>
                <span className="font-semibold text-slate-800 truncate">{employee.unit_kerja || '-'}</span>
              </div>

              {employee.pangkat_golongan && employee.pangkat_golongan !== '-' && (
                <div className="flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-500 font-medium shrink-0">Pangkat/Gol:</span>
                  <span className="text-slate-800 font-medium truncate">{employee.pangkat_golongan}</span>
                </div>
              )}

              {employee.instansi && employee.instansi !== '-' && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium shrink-0 pl-5">Instansi:</span>
                  <span className="text-slate-600 truncate">{employee.instansi}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar confidence score */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500">Tingkat Kemiripan Biometrik</span>
            <span className="font-mono font-bold text-emerald-700">{confidence}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(5, confidence))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
