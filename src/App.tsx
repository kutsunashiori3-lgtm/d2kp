/**
 * Main Application Component for Face Recognition Pegawai
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Employee, DatabaseStats, AppSettings, RecognitionLog } from './types';
import {
  getAllEmployees,
  calculateDatabaseStats,
  getStoredSettings,
  getAllLogs,
  DEFAULT_SETTINGS,
} from './services/database';
import { Dashboard } from './pages/Dashboard';
import { CameraView } from './components/CameraView';
import { ExcelImporter } from './components/ExcelImporter';
import { FolderImporter } from './components/FolderImporter';
import { DatabaseTable } from './components/DatabaseTable';
import { DatabaseValidation } from './components/DatabaseValidation';
import { RecognitionHistory } from './components/RecognitionHistory';
import { Settings } from './components/Settings';
import {
  LayoutDashboard,
  Camera,
  FileSpreadsheet,
  FolderOpen,
  Users,
  CheckSquare,
  History,
  Sliders,
  ShieldCheck,
  Lock,
} from 'lucide-react';

type TabType =
  | 'dashboard'
  | 'camera'
  | 'import_excel'
  | 'import_folder'
  | 'validation'
  | 'database'
  | 'history'
  | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<DatabaseStats>({
    totalExcel: 0,
    totalPhotos: 0,
    connected: 0,
    photoNotFoundInExcel: 0,
    excelWithoutPhoto: 0,
    photoFailed: 0,
    embeddingReady: 0,
  });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [recentLogs, setRecentLogs] = useState<RecognitionLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load all data from IndexedDB
  const refreshAllData = useCallback(async () => {
    try {
      const [empList, dbStats, appSettings, logs] = await Promise.all([
        getAllEmployees(),
        calculateDatabaseStats(),
        getStoredSettings(),
        getAllLogs(),
      ]);

      setEmployees(empList);
      setStats(dbStats);
      setSettings(appSettings);
      setRecentLogs(logs.slice(0, 10));
    } catch (err) {
      console.error('Failed to load local database:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Enterprise Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and App Title */}
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setActiveTab('dashboard')}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20">
                <ShieldCheck className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                    Face Recognition Pegawai
                  </h1>
                  <span className="hidden sm:inline-block px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-bold rounded-md uppercase tracking-wider border border-blue-200">
                    Lokal &bull; Offline
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Sistem Biometrik Wajah Berbasis Database Foto & Excel
                </p>
              </div>
            </div>

            {/* Privacy & Embedding Status Pills */}
            <div className="flex items-center gap-2.5">
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{stats.embeddingReady} Wajah Siap</span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600" title="Data diproses 100% di browser tanpa cloud">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] hidden sm:inline">100% Data Lokal</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'camera'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Kamera</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('import_excel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'import_excel'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('import_folder')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'import_folder'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Import Folder Foto</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('validation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'validation'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Validasi Relasi</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('database')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'database'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Database Pegawai ({employees.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'history'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'settings'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Pengaturan</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center p-16 text-slate-400 text-xs">
            Memuat database lokal...
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                stats={stats}
                employees={employees}
                recentLogs={recentLogs}
                onNavigate={(t) => setActiveTab(t)}
                onRefreshData={refreshAllData}
              />
            )}

            {activeTab === 'camera' && (
              <CameraView
                employees={employees}
                settings={settings}
                onNavigateToImport={() => setActiveTab('import_folder')}
              />
            )}

            {activeTab === 'import_excel' && (
              <ExcelImporter
                onSuccess={() => {
                  refreshAllData();
                  setTimeout(() => setActiveTab('database'), 1200);
                }}
              />
            )}

            {activeTab === 'import_folder' && (
              <FolderImporter
                onSuccess={() => {
                  refreshAllData();
                  setTimeout(() => setActiveTab('camera'), 1500);
                }}
              />
            )}

            {activeTab === 'validation' && (
              <DatabaseValidation
                employees={employees}
                stats={stats}
                onRefreshData={refreshAllData}
                onNavigate={(t) => setActiveTab(t)}
              />
            )}

            {activeTab === 'database' && (
              <DatabaseTable
                employees={employees}
                onDataChanged={refreshAllData}
              />
            )}

            {activeTab === 'history' && <RecognitionHistory />}

            {activeTab === 'settings' && (
              <Settings
                settings={settings}
                onSettingsChanged={(newS) => setSettings(newS)}
                onDataReset={refreshAllData}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Face Recognition Pegawai &bull; Sistem Pengenalan Wajah Berbasis Offline & IndexedDB
          </span>
          <span className="font-mono text-slate-400 text-[11px]">
            Primary Key: Nomor Induk | Model: SSD MobileNet + ResNet-34
          </span>
        </div>
      </footer>
    </div>
  );
}
