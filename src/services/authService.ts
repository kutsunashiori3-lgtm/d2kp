/**
 * Client Authentication Service
 * Handles server session validation, login, logout, and password updates.
 */

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  last_login?: number | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  expiresAt: number | null;
  isLoading: boolean;
}

const TOKEN_KEY = 'fr_session_token';

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
  } catch {
    // ignore
  }
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
 * Check current authentication status from server
 */
export async function checkAuthStatus(): Promise<{
  isAuthenticated: boolean;
  user: AuthUser | null;
  expiresAt: number | null;
}> {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!res.ok) {
      clearStoredToken();
      return { isAuthenticated: false, user: null, expiresAt: null };
    }

    const data = await res.json();
    if (data.authenticated && data.user) {
      return {
        isAuthenticated: true,
        user: data.user,
        expiresAt: data.expiresAt || null,
      };
    }

    return { isAuthenticated: false, user: null, expiresAt: null };
  } catch (err) {
    console.warn('Network error checking auth status:', err);
    // If token exists, do not immediately kick user if network is momentarily disconnected
    return { isAuthenticated: false, user: null, expiresAt: null };
  }
}

/**
 * Perform login request
 */
export async function loginUser(
  username: string,
  password: string
): Promise<{ success: boolean; user: AuthUser; token: string; expiresAt: number }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include',
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Username atau password salah.');
  }

  if (data.token) {
    saveStoredToken(data.token);
  }

  return data;
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
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
    credentials: 'include',
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Gagal mengubah password.');
  }

  return data;
}
