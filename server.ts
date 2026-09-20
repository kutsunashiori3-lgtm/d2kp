/**
 * Full-Stack Server for Face Recognition Pegawai
 * Implements secure authentication, session management, rate limiting,
 * password hashing with bcrypt, protected API routes, and Vite SPA middleware.
 */
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const app = express();

app.use(express.json());
app.use(cookieParser());

// Trust proxy for secure cookies in Cloud Run / Nginx
app.set('trust proxy', 1);

// ==========================================
// 1. Storage & User Database (data/users.json)
// ==========================================
const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  role: 'admin' | 'user';
  created_at: number;
  updated_at: number;
  last_login: number | null;
}

// Ensure data directory and users.json exist with initial admin
function initUserDatabase(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let users: UserRecord[] = [];
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      users = JSON.parse(raw);
    } catch (err) {
      console.error('Error reading users.json, reinitializing...', err);
      users = [];
    }
  }

  const initialUsername = (process.env.ADMIN_USERNAME || 'arik').trim().toLowerCase();
  const initialPassword = process.env.ADMIN_PASSWORD || 'Ayosholat5waktu';

  const existingAdmin = users.find((u) => u.username.toLowerCase() === initialUsername);
  if (!existingAdmin) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(initialPassword, salt);
    const newAdmin: UserRecord = {
      id: 'usr_' + crypto.randomBytes(8).toString('hex'),
      username: initialUsername,
      password_hash: hash,
      role: 'admin',
      created_at: Date.now(),
      updated_at: Date.now(),
      last_login: null,
    };
    users.push(newAdmin);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    console.log(`[AUTH] Initial admin account '${initialUsername}' created successfully.`);
  }
}

initUserDatabase();

function getAllUsers(): UserRecord[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to read users file:', err);
  }
  return [];
}

function saveUsers(users: UserRecord[]): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save users file:', err);
  }
}

// ==========================================
// 2. Session Configuration & Store
// ==========================================
// Parse SESSION_TIMEOUT (e.g. "8h", "30m", "1d", default: 8 hours)
function parseSessionTimeout(timeoutStr: string | undefined): number {
  if (!timeoutStr) return 8 * 60 * 60 * 1000;
  const match = timeoutStr.trim().match(/^(\d+)([smhd]?)$/i);
  if (!match) return 8 * 60 * 60 * 1000;
  const val = parseInt(match[1], 10);
  const unit = (match[2] || 'h').toLowerCase();
  switch (unit) {
    case 's': return val * 1000;
    case 'm': return val * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    case 'h':
    default: return val * 60 * 60 * 1000;
  }
}

const SESSION_DURATION_MS = parseSessionTimeout(process.env.SESSION_TIMEOUT);

interface SessionData {
  id: string;
  userId: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: number;
  expiresAt: number;
}

const activeSessions = new Map<string, SessionData>();

// Periodic cleanup of expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of activeSessions.entries()) {
    if (sess.expiresAt <= now) {
      activeSessions.delete(token);
    }
  }
}, 10 * 60 * 1000);

// ==========================================
// 3. Rate Limiting Protection (5 failed attempts)
// ==========================================
interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const loginRateLimits = new Map<string, RateLimitRecord>();

function checkRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginRateLimits.get(key);
  if (!record) return { allowed: true };

  // Check if actively locked
  if (record.lockedUntil && record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Reset if window of 5 minutes expired
  if (now - record.firstAttemptAt > 5 * 60 * 1000) {
    loginRateLimits.delete(key);
    return { allowed: true };
  }

  // If 5 attempts or more
  if (record.attempts >= 5) {
    record.lockedUntil = now + 5 * 60 * 1000; // Lock for 5 minutes
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  return { allowed: true };
}

function recordFailedLogin(key: string): void {
  const now = Date.now();
  const record = loginRateLimits.get(key);
  if (!record) {
    loginRateLimits.set(key, { attempts: 1, firstAttemptAt: now, lockedUntil: null });
  } else {
    record.attempts += 1;
    if (record.attempts >= 5) {
      record.lockedUntil = now + 5 * 60 * 1000;
    }
  }
}

function clearRateLimit(key: string): void {
  loginRateLimits.delete(key);
}

// ==========================================
// 4. Authentication Middleware
// ==========================================
export interface AuthenticatedRequest extends Request {
  sessionUser?: SessionData;
}

function getSessionFromRequest(req: Request): SessionData | null {
  // Check cookie first
  let token = req.cookies?.session_token;

  // Check Authorization Bearer header as fallback (supports both iframe and cross-origin)
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) return null;

  const session = activeSessions.get(token);
  if (!session) return null;

  // Check expiration
  if (session.expiresAt <= Date.now()) {
    activeSessions.delete(token);
    return null;
  }

  return session;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized. Sesi telah berakhir atau belum login.' });
    return;
  }
  req.sessionUser = session;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized. Sesi telah berakhir atau belum login.' });
    return;
  }
  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden. Fitur ini hanya untuk Administrator.' });
    return;
  }
  req.sessionUser = session;
  next();
}

// ==========================================
// 5. Auth API Routes
// ==========================================

// POST /api/auth/login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    res.status(400).json({ error: 'Username dan password wajib diisi.' });
    return;
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const rateLimitKey = `${clientIp}_${cleanUsername}`;

  // Check rate limit
  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    res.status(429).json({
      error: 'Too many login attempts. Silakan coba lagi beberapa saat.',
      retryAfterSeconds: rateCheck.waitSeconds,
    });
    return;
  }

  const users = getAllUsers();
  const user = users.find((u) => u.username.toLowerCase() === cleanUsername);

  if (!user) {
    recordFailedLogin(rateLimitKey);
    // Generic message to prevent username enumeration
    res.status(401).json({ error: 'Username atau password salah.' });
    return;
  }

  const isPasswordMatch = bcrypt.compareSync(String(password), user.password_hash);
  if (!isPasswordMatch) {
    recordFailedLogin(rateLimitKey);
    res.status(401).json({ error: 'Username atau password salah.' });
    return;
  }

  // Clear rate limits upon successful login
  clearRateLimit(rateLimitKey);

  // Update last_login
  user.last_login = Date.now();
  saveUsers(users);

  // Generate cryptographically secure session token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  const sessionData: SessionData = {
    id: token,
    userId: user.id,
    username: user.username,
    role: user.role,
    createdAt: Date.now(),
    expiresAt,
  };

  activeSessions.set(token, sessionData);

  // Set HTTP-only cookie
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('session_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: SESSION_DURATION_MS,
    path: '/',
  });

  res.json({
    success: true,
    token, // Also returned for client Bearer header authorization if needed
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      last_login: user.last_login,
    },
    expiresAt,
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  let token = req.cookies?.session_token;
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') token = parts[1];
  }

  if (token) {
    activeSessions.delete(token);
  }

  res.clearCookie('session_token', { path: '/' });
  res.json({ success: true, message: 'Logout berhasil.' });
});

// GET /api/auth/me
app.get('/api/auth/me', (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ authenticated: false, error: 'Sesi tidak valid atau telah berakhir.' });
    return;
  }

  res.json({
    authenticated: true,
    user: {
      id: session.userId,
      username: session.username,
      role: session.role,
    },
    expiresAt: session.expiresAt,
  });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { oldPassword, newPassword, confirmPassword } = req.body || {};
  const currentUsername = req.sessionUser!.username;

  if (!oldPassword || !newPassword) {
    res.status(400).json({ error: 'Password lama dan password baru wajib diisi.' });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: 'Konfirmasi password baru tidak cocok.' });
    return;
  }

  if (String(newPassword).length < 8) {
    res.status(400).json({ error: 'Password baru minimal 8 karakter.' });
    return;
  }

  const users = getAllUsers();
  const user = users.find((u) => u.username.toLowerCase() === currentUsername.toLowerCase());

  if (!user) {
    res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }

  const isOldValid = bcrypt.compareSync(String(oldPassword), user.password_hash);
  if (!isOldValid) {
    res.status(400).json({ error: 'Password lama tidak sesuai.' });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  user.password_hash = bcrypt.hashSync(String(newPassword), salt);
  user.updated_at = Date.now();
  saveUsers(users);

  res.json({ success: true, message: 'Password berhasil diperbarui.' });
});

// ==========================================
// 6. Protected Business & Admin API Endpoints
// ==========================================

// GET /api/database/status (Protected)
app.get('/api/database/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    status: 'ok',
    serverTime: Date.now(),
    authenticatedUser: req.sessionUser?.username,
    role: req.sessionUser?.role,
  });
});

// GET /api/employees (Protected)
app.get('/api/employees', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    status: 'ok',
    storage: 'IndexedDB (Local Client Biometrics)',
    user: req.sessionUser?.username,
  });
});

// Admin Only Endpoints
app.post('/api/admin/upload-excel', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Excel import authorized for admin.' });
});

app.post('/api/admin/upload-photos', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Photo folder import authorized for admin.' });
});

app.post('/api/admin/rebuild-embeddings', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Embedding rebuild authorized for admin.' });
});

app.delete('/api/admin/database', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Database reset authorized for admin.' });
});

// ==========================================
// 7. Vite Integration & SPA Static Serving
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Face Recognition server running on http://0.0.0.0:${PORT}`);
    console.log(`[AUTH] Session timeout configured to: ${SESSION_DURATION_MS / (1000 * 60 * 60)} hours.`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
