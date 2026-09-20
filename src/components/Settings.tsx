/**
 * Application Settings component.
 * Allows tweaking Face Match Threshold, confirmation frames, detector models,
 * audio chime, and data reset operations.
 */
import React, { useState } from 'react';
import { AppSettings } from '../types';
import { saveStoredSettings, clearAllEmbeddings, clearAllEmployees } from '../services/database';
import {
  Sliders,
  Shield,
  Volume2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Cpu,
  Clock,
  Trash2,
  Info,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { changeUserPassword, AuthUser } from '../services/authService';

interface SettingsProps {
  settings: AppSettings;
  onSettingsChanged: (newSettings: AppSettings) => void;
  onDataReset: () => void;
  currentUser?: AuthUser | null;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onSettingsChanged,
  onDataReset,
  currentUser,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Password change state
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showOldPass, setShowOldPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [isChangingPass, setIsChangingPass] = useState<boolean>(false);
  const [passFeedback, setPassFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassFeedback(null);

    if (!oldPassword || !newPassword) {
      setPassFeedback({ type: 'error', message: 'Semua kolom password wajib diisi.' });
      return;
    }

    if (newPassword.length < 8) {
      setPassFeedback({ type: 'error', message: 'Password baru minimal 8 karakter.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassFeedback({ type: 'error', message: 'Konfirmasi password baru tidak sesuai.' });
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await changeUserPassword(oldPassword, newPassword, confirmPassword);
      setPassFeedback({ type: 'success', message: res.message });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPassFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal memperbarui password.',
      });
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleSave = async (updated: AppSettings) => {
    setLocalSettings(updated);
    await saveStoredSettings(updated);
    onSettingsChanged(updated);
    setSaveFeedback('Pengaturan berhasil disimpan!');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleResetEmbeddings = async () => {
    if (
      confirm(
        'Apakah Anda yakin ingin menghapus seluruh Face Embedding biometrik? Data identitas Excel akan tetap tersimpan, namun Anda perlu mengimpor ulang folder foto.'
      )
    ) {
      await clearAllEmbeddings();
      onDataReset();
      alert('Semua embedding wajah berhasil dihapus.');
    }
  };

  const handleResetEntireDatabase = async () => {
    const confirmation = prompt(
      'PERINGATAN: Tindakan ini akan menghapus seluruh data pegawai, foto, dan embedding dari database lokal. Ketik "HAPUS" untuk konfirmasi:'
    );
    if (confirmation === 'HAPUS') {
      await clearAllEmployees();
      onDataReset();
      alert('Seluruh database pegawai berhasil dihapus.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
              Pengaturan Sistem Face Recognition
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Konfigurasi akurasi threshold, algoritma pendeteksi, dan preferensi privasi biometrik lokal.
            </p>
          </div>
          {saveFeedback && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saveFeedback}
            </span>
          )}
        </div>

        {/* Setting 1: Face Match Threshold */}
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                Face Match Threshold (Jarak Euclidean)
              </label>
              <span className="font-mono text-sm font-bold px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-lg">
                {localSettings.matchThreshold.toFixed(2)}
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Menentukan batas toleransi jarak embedding vektor biometrik untuk menerima kecocokan wajah.
            </p>

            <input
              type="range"
              min="0.35"
              max="0.65"
              step="0.01"
              value={localSettings.matchThreshold}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                handleSave({ ...localSettings, matchThreshold: val });
              }}
              className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />

            <div className="flex justify-between text-[11px] font-medium text-slate-500 mt-1">
              <span className="text-blue-700 font-semibold">0.35 (Sangat Ketat)</span>
              <span>0.50 (Seimbang / Rekomendasi)</span>
              <span className="text-amber-700 font-semibold">0.65 (Toleran)</span>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-200/80 text-xs text-slate-600 space-y-1">
              <div className="flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Threshold Lebih Rendah (&lt; 0.45):</strong> Sangat ketat, mengurangi risiko salah kenali (false positive), namun membutuhkan pose wajah tegak dan pencahayaan terang.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Threshold Lebih Tinggi (&gt; 0.55):</strong> Lebih mudah menerima kecocokan saat wajah sedikit miring atau ekspresi berbeda, namun risiko kemiripan antar orang meningkat.
                </span>
              </div>
            </div>
          </div>

          {/* Setting 2: Temporal Multi-Frame Confirmation */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                Konfirmasi Multi-Frame (Anti False-Positive)
              </label>
              <span className="font-mono text-sm font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg">
                {localSettings.confirmationFrames} dari 5 Frame
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Mencegah false positive dari satu frame sesaat. Sistem mensyaratkan identitas pegawai terdeteksi konsisten sebanyak frame yang ditentukan sebelum status "Terkonfirmasi" dan log tercatat.
            </p>

            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleSave({ ...localSettings, confirmationFrames: count })}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    localSettings.confirmationFrames === count
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {count} Frame {count === 3 && '(Default)'}
                </button>
              ))}
            </div>
          </div>

          {/* Setting 3: Detector Model Architecture */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-purple-600" />
              Arsitektur Model AI Pendeteksi Wajah
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div
                onClick={() => handleSave({ ...localSettings, detectorType: 'ssdMobilenetv1' })}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  localSettings.detectorType === 'ssdMobilenetv1'
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs text-slate-900 mb-1">
                  <span>SSD MobileNet V1</span>
                  {localSettings.detectorType === 'ssdMobilenetv1' && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Akurasi deteksi wajah tertinggi. Sangat stabil untuk lingkungan kantor/pemerintahan dan pencahayaan dinamis.
                </p>
              </div>

              <div
                onClick={() => handleSave({ ...localSettings, detectorType: 'tinyFaceDetector' })}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  localSettings.detectorType === 'tinyFaceDetector'
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs text-slate-900 mb-1">
                  <span>Tiny Face Detector</span>
                  {localSettings.detectorType === 'tinyFaceDetector' && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Model ringan dengan konsumsi CPU rendah. Cocok untuk laptop atau komputer berspesifikasi terbatas.
                </p>
              </div>
            </div>
          </div>

          {/* Setting 4: Audio Chime & Anti-Spoofing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Bunyi Chime Pengenalan
                </span>
                <span className="text-[11px] text-slate-500">
                  Mainkan nada konfirmasi saat wajah berhasil diverifikasi.
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleSave({ ...localSettings, beepOnRecognize: !localSettings.beepOnRecognize })
                }
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  localSettings.beepOnRecognize ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-md block absolute top-0.5 transition-transform ${
                    localSettings.beepOnRecognize ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Liveness / Anti-Spoofing
                </span>
                <span className="text-[11px] text-slate-500">
                  Validasi kedipan mata (EAR) untuk mengurangi foto cetak/layar HP.
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleSave({ ...localSettings, enableAntiSpoofing: !localSettings.enableAntiSpoofing })
                }
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  localSettings.enableAntiSpoofing ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-md block absolute top-0.5 transition-transform ${
                    localSettings.enableAntiSpoofing ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keamanan Akun & Ubah Password */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm pb-4 border-b border-slate-100">
          <KeyRound className="w-4 h-4 text-blue-600" />
          <span>Keamanan Akun & Ubah Password</span>
        </div>

        <p className="text-xs text-slate-500 mt-3 mb-4">
          Akun saat ini: <strong className="text-slate-800 font-mono">{currentUser?.username || 'arik'}</strong> ({currentUser?.role === 'admin' ? 'Administrator' : 'User'}). Ubah password secara berkala untuk menjaga integritas sistem presensi.
        </p>

        {passFeedback && (
          <div
            className={`p-3.5 mb-4 rounded-xl text-xs font-medium flex items-center gap-2 border ${
              passFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {passFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{passFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password Lama
            </label>
            <div className="relative rounded-xl">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showOldPass ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full text-xs pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowOldPass(!showOldPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password Baru (Minimal 8 Karakter)
            </label>
            <div className="relative rounded-xl">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={8}
                className="w-full text-xs pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Konfirmasi Password Baru
            </label>
            <div className="relative rounded-xl">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <input
                type={showNewPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={8}
                className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isChangingPass}
            className="px-4 py-2 bg-blue-900 hover:bg-blue-800 disabled:bg-blue-300 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            {isChangingPass ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Menyimpan Password...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                <span>Simpan Password Baru</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6">
        <div className="flex items-center gap-2 text-rose-700 font-bold text-sm pb-3 border-b border-rose-100">
          <AlertTriangle className="w-4 h-4" />
          <span>Zona Pengelolaan Data & Reset (Privasi Biometrik)</span>
        </div>

        <p className="text-xs text-slate-500 mt-3">
          Seluruh data biometrik wajah dan identitas pegawai disimpan 100% secara lokal di dalam IndexedDB browser komputer Anda dan tidak pernah dikirim ke server eksternal. Anda memiliki kontrol penuh untuk menghapus data kapan pun.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleResetEmbeddings}
            className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Hapus Semua Embedding Wajah
          </button>

          <button
            type="button"
            onClick={handleResetEntireDatabase}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            Hapus Seluruh Database Pegawai
          </button>
        </div>
      </div>
    </div>
  );
};
