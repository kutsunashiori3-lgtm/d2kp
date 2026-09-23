/**
 * Main Application Component for Face Recognition Pegawai
 * Integrated with Secure Session Authentication, Role-based Access, and Protected Routing.
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
import { checkAuthStatus, logoutUser, AuthUser } from './services/authService';
import { ServerDatabaseStatus } from './types';
import {
  fetchServerStatus,
  syncClientWithServerMaster,
  syncAllDataToServer,
  fetchServerSyncStatus,
  triggerServerFolderSync,
} from './services/serverDbService';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { CameraView } from './components/CameraView';
import { PhotoIdentification } from './components/PhotoIdentification';
import { ServerDatabasePanel } from './components/ServerDatabasePanel';
import { ServerFolderSyncPanel } from './components/ServerFolderSyncPanel';
import { ServerFolderSyncModal } from './components/ServerFolderSyncModal';
import { ExcelImporter } from './components/ExcelImporter';
import { FolderImporter } from './components/FolderImporter';
import { DatabaseTable } from './components/DatabaseTable';
import { DatabaseValidation } from './components/DatabaseValidation';
import { RecognitionHistory } from './components/RecognitionHistory';
import { Settings } from './components/Settings';
import {
  LayoutDashboard,
  Camera,
  FileImage,
  Server,
  FileSpreadsheet,
  FolderOpen,
  FolderSync,
  Users,
  CheckSquare,
  History,
  Sliders,
  ShieldCheck,
  Lock,
  LogOut,
  User as UserIcon,
  RefreshCw,
} from 'lucide-react';

type TabType =
  | 'dashboard'
  | 'camera'
  | 'photo_identification'
  | 'server_db'
  | 'server_sync'
  | 'import_excel'
  | 'import_folder'
  | 'validation'
  | 'database'
  | 'history'
  | 'settings';

const VALID_TABS: TabType[] = [
  'dashboard',
  'camera',
  'photo_identification',
  'server_db',
  'server_sync',
  'import_excel',
  'import_folder',
  'validation',
  'database',
  'history',
  'settings',
];

export default function App() {
  // Authentication states
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);

  // App & Tab states
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isGlobalSyncModalOpen, setIsGlobalSyncModalOpen] = useState<boolean>(false);
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
  const [serverStatus, setServerStatus] = useState<ServerDatabaseStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load all data from Master Server (Single Source of Truth) with local fallback
  const refreshAllData = useCallback(async () => {
    try {
      // 1. Fetch live master server status
      const sStatus = await fetchServerStatus();
      setServerStatus(sStatus);

      let empList: Employee[] = [];

      if (sStatus && sStatus.ready && sStatus.employeeCount > 0) {
        // SERVER IS THE MASTER DATA SOURCE! Pull from server and mirror to local cache
        const syncRes = await syncClientWithServerMaster();
        if (syncRes.synced && syncRes.employees.length > 0) {
          empList = syncRes.employees;
        } else {
          empList = await getAllEmployees();
        }
      } else {
        // Server has no employees yet: check if local client has existing data to migrate
        const localList = await getAllEmployees();
        if (localList.length > 0) {
          console.log('[AUTO-MIGRATION] Migrating existing local client data to Server Master...');
          const migRes = await syncAllDataToServer();
          if (migRes.success) {
            const updatedStatus = await fetchServerStatus();
            setServerStatus(updatedStatus);
          }
          empList = localList;
        } else {
          empList = [];
        }
      }

      const [dbStats, appSettings, logs] = await Promise.all([
        calculateDatabaseStats(empList),
        getStoredSettings(),
        getAllLogs(),
      ]);

      setEmployees(empList);
      setStats(dbStats);
      setSettings(appSettings);
      setRecentLogs(logs.slice(0, 10));
    } catch (err) {
      console.error('Failed to load database:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Safe tab navigation with browser URL synchronization
  const navigateToTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (window.location.pathname !== `/${tab}`) {
      window.history.pushState({}, '', `/${tab}`);
    }
  }, []);

  // Initial Auth Verification & Route Sync
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        const result = await checkAuthStatus();
        if (!isMounted) return;

        if (result.isAuthenticated && result.user) {
          setAuthUser(result.user);
          setSessionExpiresAt(result.expiresAt);

          // Route parsing from path
          const currentPath = window.location.pathname.replace('/', '') as TabType;
          if (VALID_TABS.includes(currentPath)) {
            setActiveTab(currentPath);
          } else {
            // Default to dashboard if on root or /login
            window.history.replaceState({}, '', '/dashboard');
            setActiveTab('dashboard');
          }
          refreshAllData();
        } else {
          setAuthUser(null);
          setSessionExpiresAt(null);
          window.history.replaceState({}, '', '/login');
        }
      } catch (err) {
        console.error('Auth verification error:', err);
        setAuthUser(null);
        window.history.replaceState({}, '', '/login');
      } finally {
        if (isMounted) {
          setIsAuthChecking(false);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [refreshAllData]);

  // Browser Back/Forward navigation listener
  useEffect(() => {
    const handlePopState = () => {
      const rawPath = window.location.pathname.replace('/', '');
      if (!authUser) {
        window.history.replaceState({}, '', '/login');
      } else {
        if (!rawPath || rawPath === 'login') {
          navigateToTab('dashboard');
        } else if (VALID_TABS.includes(rawPath as TabType)) {
          setActiveTab(rawPath as TabType);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [authUser, navigateToTab]);

  // Session Expiration Watcher
  useEffect(() => {
    if (!sessionExpiresAt || !authUser) return;

    const checkTimeout = () => {
      if (Date.now() >= sessionExpiresAt) {
        alert('SESSION EXPIRED: Sesi login Anda telah berakhir. Silakan login kembali.');
        handleLogout();
      }
    };

    const timer = setInterval(checkTimeout, 20000);
    return () => clearInterval(timer);
  }, [sessionExpiresAt, authUser]);

  // Periodic background check for folder synchronization (30 seconds)
  useEffect(() => {
    if (!authUser || authUser.role !== 'admin') return;

    let isProcessing = false;
    const checkServerFiles = async () => {
      if (isProcessing) return;
      try {
        const syncStatus = await fetchServerSyncStatus();
        if (syncStatus && syncStatus.pendingPhotosCount > 0) {
          isProcessing = true;
          await triggerServerFolderSync();
          await refreshAllData();
        }
      } catch {
        // Silently ignore background polling errors
      } finally {
        isProcessing = false;
      }
    };

    const interval = setInterval(checkServerFiles, 30000);
    return () => clearInterval(interval);
  }, [authUser, refreshAllData]);

  // Handle Login Success from LoginPage
  const handleLoginSuccess = (user: AuthUser, expiresAt: number) => {
    setAuthUser(user);
    setSessionExpiresAt(expiresAt);
    window.history.replaceState({}, '', '/dashboard');
    setActiveTab('dashboard');
    refreshAllData();
  };

  // Handle Logout
  const handleLogout = async () => {
    await logoutUser();
    setAuthUser(null);
    setSessionExpiresAt(null);
    window.history.replaceState({}, '', '/login');
  };

  // Loading Screen while verifying session
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center font-['Plus_Jakarta_Sans',sans-serif] text-white">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4 animate-pulse">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <p className="text-xs font-semibold text-slate-300">
          Memeriksa sesi keamanan sistem...
        </p>
      </div>
    );
  }

  // Not logged in -> Show Login Page
  if (!authUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Authenticated -> Render Full Application
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Enterprise Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and App Title */}
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigateToTab('dashboard')}
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

            {/* Right: Server Status, Embedding Badge, User Info & Logout */}
            <div className="flex items-center gap-3">
              {/* SINKRONISASI DATA SERVER BUTTON (Admin) */}
              {authUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setIsGlobalSyncModalOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sinkronisasi Server</span>
                </button>
              )}

              {/* Server Online Badge */}
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-xs font-semibold text-indigo-900">
                <Server className="w-3.5 h-3.5 text-indigo-600" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Server Master</span>
              </div>

              {/* Privacy & Embedding Status Pills */}
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{stats.embeddingReady} Wajah Siap</span>
              </div>

              {/* User Account Details */}
              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-end gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-mono">{authUser.username}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {authUser.role === 'admin' ? 'Administrator' : 'User'}
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Keluar dari sesi"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigateToTab('dashboard')}
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
              onClick={() => navigateToTab('camera')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'camera'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Kamera Real-Time</span>
            </button>

            <button
              type="button"
              onClick={() => navigateToTab('photo_identification')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'photo_identification'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileImage className="w-3.5 h-3.5 text-blue-400" />
              <span>Identifikasi Foto</span>
            </button>

            {/* Admin Only Tabs */}
            {authUser.role === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => navigateToTab('server_sync')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    activeTab === 'server_sync'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FolderSync className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Penyimpanan Server</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('server_db')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    activeTab === 'server_db'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Server className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Database Server</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('validation')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    activeTab === 'validation'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Validasi Relasi</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => navigateToTab('database')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'database'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Data Pegawai</span>
            </button>

            <button
              type="button"
              onClick={() => navigateToTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'history'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat Presensi</span>
            </button>

            <button
              type="button"
              onClick={() => navigateToTab('settings')}
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
                serverStatus={serverStatus}
                currentUser={authUser}
                onNavigate={(t) => navigateToTab(t)}
                onRefreshData={refreshAllData}
              />
            )}

            {activeTab === 'server_sync' && authUser.role === 'admin' && (
              <ServerFolderSyncPanel />
            )}

            {activeTab === 'server_db' && authUser.role === 'admin' && (
              <ServerDatabasePanel
                onNavigateTab={(t) => navigateToTab(t)}
                onDataUpdated={refreshAllData}
              />
            )}

            {activeTab === 'camera' && (
              <CameraView
                employees={employees}
                settings={settings}
                onNavigateToImport={() => navigateToTab('server_sync')}
              />
            )}

            {activeTab === 'photo_identification' && (
              <PhotoIdentification
                employees={employees}
                settings={settings}
                onNavigateToHistory={() => navigateToTab('history')}
              />
            )}

            {/* Fallback to server sync if old import route is triggered */}
            {(activeTab === 'import_excel' || activeTab === 'import_folder') && authUser.role === 'admin' && (
              <ServerFolderSyncPanel />
            )}

            {activeTab === 'validation' && authUser.role === 'admin' && (
              <DatabaseValidation
                employees={employees}
                stats={stats}
                onRefreshData={refreshAllData}
                onNavigate={(t) => navigateToTab(t)}
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
                currentUser={authUser}
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

      {/* Global Server Folder Sync Modal */}
      <ServerFolderSyncModal
        isOpen={isGlobalSyncModalOpen}
        onClose={() => setIsGlobalSyncModalOpen(false)}
        onSyncComplete={() => refreshAllData()}
      />
    </div>
  );
}
