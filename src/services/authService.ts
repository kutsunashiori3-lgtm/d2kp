/**
 * Client Authentication Service
 * Handles server session validation, login, logout, password updates,
 * and seamless fallback offline admin mode if backend server is not reachable.
 */

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  last_login?: number | null;
  isOffline?: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  expiresAt: number | null;
  isLoading: boolean;
}

const TOKEN_KEY = 'fr_session_token';
const OFFLINE_USER_KEY = 'fr_offline_user';
const OFFLINE_CREDS_KEY = 'fr_offline_custom_pass';
const DEFAULT_ADMIN_USER = 'arik';
const DEFAULT_ADMIN_PASS = 'Ayosholat5waktu';

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveStoredToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(OFFLINE_USER_KEY);
    localStorage.removeItem(OFFLINE_USER_KEY);
  } catch {
    // ignore
  }
}

function saveLocalOfflineUser(user: AuthUser, expiresAt: number): void {
  try {
    const payload = JSON.stringify({ user, expiresAt });
    localStorage.setItem(OFFLINE_USER_KEY, payload);
  } catch {
    // ignore
  }
}

function getLocalOfflineUser(): { user: AuthUser; expiresAt: number } | null {
  try {
    const raw = localStorage.getItem(OFFLINE_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.expiresAt && Date.now() < parsed.expiresAt) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function isOfflineSession(): boolean {
  const token = getStoredToken();
  return Boolean(token && token.startsWith('offline_'));
}

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Safe JSON response parser that prevents
 * "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
 */
async function parseResponseJson<T = any>(res: Response): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  rawText: string;
}> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    rawText = '';
  }

  let data: T | null = null;
  if (rawText && rawText.trim().length > 0) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  return { ok: res.ok, status: res.status, data, rawText };
}

/**
 * Check current authentication status from server
 */
export async function checkAuthStatus(): Promise<{
  isAuthenticated: boolean;
  user: AuthUser | null;
  expiresAt: number | null;
}> {
  const token = getStoredToken();
  if (!token) {
    return { isAuthenticated: false, user: null, expiresAt: null };
  }

  // Check if offline session is active
  if (token.startsWith('offline_')) {
    const offlineData = getLocalOfflineUser();
    if (offlineData) {
      return {
        isAuthenticated: true,
        user: { ...offlineData.user, isOffline: true },
        expiresAt: offlineData.expiresAt,
      };
    }
  }

  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    const { ok, status, data } = await parseResponseJson<{
      authenticated: boolean;
      user: AuthUser;
      expiresAt: number;
    }>(res);

    if (ok && data?.authenticated && data.user) {
      return {
        isAuthenticated: true,
        user: data.user,
        expiresAt: data.expiresAt || null,
      };
    }

    // If server returned 401 Unauthorized, clear token
    if (status === 401) {
      clearStoredToken();
      return { isAuthenticated: false, user: null, expiresAt: null };
    }

    // If server returned 404/405/502/503 (e.g. server temporarily down or proxy issue),
    // check if offline session can be preserved
    const offlineData = getLocalOfflineUser();
    if (offlineData) {
      return {
        isAuthenticated: true,
        user: { ...offlineData.user, isOffline: true },
        expiresAt: offlineData.expiresAt,
      };
    }

    return { isAuthenticated: false, user: null, expiresAt: null };
  } catch (err) {
    console.warn('Network error checking auth status:', err);
    // If network error occurred, verify if offline session exists
    const offlineData = getLocalOfflineUser();
    if (offlineData) {
      return {
        isAuthenticated: true,
        user: { ...offlineData.user, isOffline: true },
        expiresAt: offlineData.expiresAt,
      };
    }
    return { isAuthenticated: false, user: null, expiresAt: null };
  }
}

/**
 * Check if given credentials match default admin or local admin password
 */
function verifyOfflineAdminCredentials(username: string, password: string): boolean {
  const cleanUser = username.trim().toLowerCase();
  const savedPass = localStorage.getItem(OFFLINE_CREDS_KEY) || DEFAULT_ADMIN_PASS;
  return cleanUser === DEFAULT_ADMIN_USER && password === savedPass;
}

/**
 * Create offline local admin session
 */
function createOfflineSession(username: string): {
  success: boolean;
  user: AuthUser;
  token: string;
  expiresAt: number;
} {
  const offlineToken = 'offline_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const user: AuthUser = {
    id: 'usr_local_admin',
    username: username.trim().toLowerCase(),
    role: 'admin',
    last_login: Date.now(),
    isOffline: true,
  };

  saveStoredToken(offlineToken);
  saveLocalOfflineUser(user, expiresAt);

  return {
    success: true,
    user,
    token: offlineToken,
    expiresAt,
  };
}

/**
 * Perform login request with intelligent server error handling and offline fallback
 */
export async function loginUser(
  username: string,
  password: string
): Promise<{ success: boolean; user: AuthUser; token: string; expiresAt: number; isOffline?: boolean }> {
  const cleanUsername = username.trim().toLowerCase();
  const loginUrl = '/api/auth/login';

  console.log('[AUTH DEBUG] Frontend sending login request to:', loginUrl, 'for username:', cleanUsername);

  let res: Response | null = null;
  let networkError: Error | null = null;

  try {
    res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, password }),
      credentials: 'include',
    });
  } catch (err) {
    networkError = err instanceof Error ? err : new Error('Network error');
  }

  // 1. Server tidak dapat dihubungi (Network error / server offline)
  if (networkError || !res) {
    console.warn('[AUTH DEBUG] Server tidak dapat dihubungi:', networkError?.message);
    if (verifyOfflineAdminCredentials(cleanUsername, password)) {
      console.log('[AUTH] Backend unreachable. Activating fallback offline administrator session.');
      return createOfflineSession(cleanUsername);
    }
    throw new Error('Server tidak dapat dihubungi.');
  }

  const contentType = res.headers.get('content-type') || '';
  console.log('[AUTH DEBUG] Response received. URL:', res.url, 'HTTP Status:', res.status, 'Content-Type:', contentType);

  // 2. Safe read body as text (Never directly call res.json() to prevent Unexpected end of JSON input)
  let rawText = '';
  try {
    rawText = await res.text();
  } catch (readErr) {
    console.warn('[AUTH DEBUG] Gagal membaca response body:', readErr);
    rawText = '';
  }

  console.log('[AUTH DEBUG] Response body preview:', rawText ? rawText.slice(0, 150) : '(empty)');

  // 3. Response kosong
  if (!rawText || rawText.trim().length === 0) {
    console.warn('[AUTH DEBUG] Server login memberikan respons kosong.');
    if (verifyOfflineAdminCredentials(cleanUsername, password)) {
      console.log('[AUTH] Server empty response. Activating fallback offline administrator session.');
      return createOfflineSession(cleanUsername);
    }
    throw new Error('Server login memberikan respons kosong.');
  }

  // 4. Parse JSON safely
  let data: any = null;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.warn('[AUTH DEBUG] Server login memberikan respons bukan JSON.');
    if (res.status === 404) {
      throw new Error('Endpoint login tidak ditemukan.');
    }
    if (res.status === 500) {
      throw new Error('Terjadi kesalahan pada server login.');
    }
    if (res.status === 401) {
      throw new Error('Username atau password salah.');
    }
    if (verifyOfflineAdminCredentials(cleanUsername, password)) {
      return createOfflineSession(cleanUsername);
    }
    throw new Error('Server login memberikan respons yang tidak valid.');
  }

  // 5. Handle HTTP status codes according to requirements
  if (res.status === 401) {
    throw new Error(data?.message || 'Username atau password salah.');
  }

  if (res.status === 404) {
    throw new Error(data?.message || 'Endpoint login tidak ditemukan.');
  }

  if (res.status === 500) {
    throw new Error(data?.message || 'Terjadi kesalahan pada server login.');
  }

  if (res.status === 400) {
    throw new Error(data?.message || data?.error || 'Username dan password wajib diisi.');
  }

  if (res.status === 403) {
    throw new Error(data?.message || data?.error || 'Akses ditolak.');
  }

  if (res.status === 429) {
    throw new Error(data?.message || 'Terlalu banyak percobaan login. Silakan tunggu beberapa saat.');
  }

  // 6. Handle successful login
  if (res.ok && data && (data.success || data.user)) {
    if (data.token) {
      saveStoredToken(data.token);
    }
    return {
      success: true,
      user: data.user,
      token: data.token || '',
      expiresAt: data.expiresAt || Date.now() + 8 * 60 * 60 * 1000,
    };
  }

  if (data && data.success === false && data.message) {
    throw new Error(data.message);
  }

  if (data && data.error) {
    throw new Error(data.error);
  }

  throw new Error('Username atau password salah.');
}

/**
 * Perform logout request
 */
export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
  } catch (err) {
    console.error('Logout request error:', err);
  } finally {
    clearStoredToken();
  }
}

/**
 * Change password
 */
export async function changeUserPassword(
  oldPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; message: string }> {
  // If in offline session, update local credentials
  if (isOfflineSession()) {
    const currentPass = localStorage.getItem(OFFLINE_CREDS_KEY) || DEFAULT_ADMIN_PASS;
    if (oldPassword !== currentPass) {
      throw new Error('Password lama tidak sesuai.');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('Konfirmasi password baru tidak cocok.');
    }
    if (newPassword.length < 8) {
      throw new Error('Password baru minimal 8 karakter.');
    }
    localStorage.setItem(OFFLINE_CREDS_KEY, newPassword);
    return { success: true, message: 'Password offline lokal berhasil diperbarui.' };
  }

  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
    credentials: 'include',
  });

  const { ok, data } = await parseResponseJson<{ success?: boolean; message?: string; error?: string }>(res);

  if (!ok) {
    throw new Error(data?.error || 'Gagal mengubah password di server.');
  }

  // Also sync with offline password backup
  try {
    localStorage.setItem(OFFLINE_CREDS_KEY, newPassword);
  } catch {
    // ignore
  }

  return {
    success: true,
    message: data?.message || 'Password berhasil diperbarui.',
  };
}
