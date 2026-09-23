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
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  initStorageDirectories,
  getServerStatus,
  getAllServerEmployees,
  saveServerEmployees,
  getServerEmployeeById,
  getAllEmbeddings,
  saveEmbeddings,
  savePhotoFile,
  getPhotoFilePath,
  saveMasterExcelFile,
  parseExcelBuffer,
  getServerSettings,
  saveServerSettings,
  getServerLogs,
  appendServerLog,
  clearServerLogs,
  createBackup,
  listBackups,
  restoreBackup,
  resetServerDatabase,
  STORAGE_PATH,
  EXCEL_PATH,
  PHOTO_PATH,
  SYNC_LOG_FILE,
  FILE_TRACKING_FILE,
  scanAndSyncServerFiles,
  applyEmbeddingResults,
  getSyncLogContent,
  loadFileTracking,
  appendSyncLog,
  ServerEmployee,
} from './server/storage';

const PORT = 3000;
const app = express();

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cookieParser());

// Support CORS and preflight requests (supports reverse proxies, custom ports, and cross-origin)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Handle JSON parse error gracefully
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    res.status(400).json({ error: 'Format JSON body tidak valid atau kosong.' });
    return;
  }
  next(err);
});

// Trust proxy for secure cookies in Cloud Run / Nginx
app.set('trust proxy', 1);

// Initialize persistent master storage directories
initStorageDirectories();

// Multer memory upload handler
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

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

const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function loadSessions(): Map<string, SessionData> {
  const map = new Map<string, SessionData>();
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      const now = Date.now();
      for (const [token, sess] of Object.entries(data)) {
        const s = sess as SessionData;
        if (s && s.expiresAt > now) {
          map.set(token, s);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load sessions file:', err);
  }
  return map;
}

function persistSessions(map: Map<string, SessionData>): void {
  try {
    const obj: Record<string, SessionData> = {};
    for (const [token, sess] of map.entries()) {
      obj[token] = sess;
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist sessions:', err);
  }
}

const activeSessions = loadSessions();

// Periodic cleanup of expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [token, sess] of activeSessions.entries()) {
    if (sess.expiresAt <= now) {
      activeSessions.delete(token);
      changed = true;
    }
  }
  if (changed) {
    persistSessions(activeSessions);
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

const handleLogin = (req: Request, res: Response) => {
  const endpoint = req.originalUrl || req.url;
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  console.log(`[AUTH LOG] Endpoint called: ${endpoint}, Request received from IP: ${clientIp}`);

  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      console.log(`[AUTH LOG] Missing username or password. Response status: 400`);
      res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi.',
        error: 'Username dan password wajib diisi.',
      });
      return;
    }

    const cleanUsername = String(username).trim().toLowerCase();
    console.log(`[AUTH LOG] Received login request for username: '${cleanUsername}'`);

    const rateLimitKey = `${clientIp}_${cleanUsername}`;

    // Check rate limit
    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      console.log(`[AUTH LOG] Rate limit exceeded for '${cleanUsername}'. Response status: 429`);
      res.status(429).json({
        success: false,
        message: 'Terlalu banyak percobaan login. Silakan coba lagi beberapa saat.',
        error: 'Too many login attempts.',
        retryAfterSeconds: rateCheck.waitSeconds,
      });
      return;
    }

    let users: UserRecord[] = [];
    try {
      users = getAllUsers();
    } catch (dbErr) {
      console.error(`[AUTH LOG] Database read error for users:`, dbErr);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: 'Gagal mengakses database pengguna.',
      });
      return;
    }

    const user = users.find((u) => u.username.toLowerCase() === cleanUsername);

    if (!user) {
      recordFailedLogin(rateLimitKey);
      console.log(`[AUTH LOG] Authentication status: FAILED (User '${cleanUsername}' not found). Response status: 401`);
      res.status(401).json({
        success: false,
        message: 'Username atau password salah',
        error: 'Username atau password salah',
      });
      return;
    }

    const isPasswordMatch = bcrypt.compareSync(String(password), user.password_hash);
    if (!isPasswordMatch) {
      recordFailedLogin(rateLimitKey);
      console.log(`[AUTH LOG] Authentication status: FAILED (Password mismatch for '${cleanUsername}'). Response status: 401`);
      res.status(401).json({
        success: false,
        message: 'Username atau password salah',
        error: 'Username atau password salah',
      });
      return;
    }

    // Clear rate limits upon successful login
    clearRateLimit(rateLimitKey);

    // Update last_login
    user.last_login = Date.now();
    try {
      saveUsers(users);
    } catch (saveErr) {
      console.error(`[AUTH LOG] Database save error for last_login:`, saveErr);
    }

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
    persistSessions(activeSessions);

    // Set HTTP-only cookie
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: SESSION_DURATION_MS,
      path: '/',
    });

    console.log(`[AUTH LOG] Authentication status: SUCCESS for user '${user.username}' (role: ${user.role}). Response status: 200`);

    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        last_login: user.last_login,
      },
      expiresAt,
    });
  } catch (err: unknown) {
    console.error('[AUTH LOG] Internal server error in login handler:', err);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
      error: 'Terjadi kesalahan pada server',
    });
  }
};

// Mount both standard routes
app.post('/api/auth/login', handleLogin);
app.post('/api/login', handleLogin);

// POST /api/auth/logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  let token = req.cookies?.session_token;
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') token = parts[1];
  }

  if (token) {
    activeSessions.delete(token);
    persistSessions(activeSessions);
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
// 6. Server Master Database & Business API Endpoints
// ==========================================

// GET /api/database/status (Protected)
app.get('/api/database/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const status = getServerStatus();
  res.json({
    status: 'ok',
    ...status,
    serverTime: Date.now(),
    authenticatedUser: req.sessionUser?.username,
    role: req.sessionUser?.role,
  });
});

// GET /api/employees (Protected)
app.get('/api/employees', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const employees = getAllServerEmployees();
  res.json({
    status: 'ok',
    total: employees.length,
    employees,
    user: req.sessionUser?.username,
  });
});

// GET /api/employees/:nomor_induk (Protected)
app.get('/api/employees/:nomor_induk', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const emp = getServerEmployeeById(req.params.nomor_induk);
  if (!emp) {
    res.status(404).json({ error: 'Pegawai tidak ditemukan di server.' });
    return;
  }
  res.json({ status: 'ok', employee: emp });
});

// GET /api/face-database (Protected)
app.get('/api/face-database', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const embeddings = getAllEmbeddings();
  const status = getServerStatus();
  res.json({
    status: 'ok',
    version: status.version,
    count: Object.keys(embeddings).length,
    embeddings,
  });
});

// GET /api/photos/:nomor_induk (Public / Session cached for <img> tags)
app.get('/api/photos/:nomor_induk', (req: Request, res: Response) => {
  const photoPath = getPhotoFilePath(req.params.nomor_induk);
  if (!photoPath) {
    res.status(404).json({ error: 'Foto tidak ditemukan di storage server.' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(photoPath);
});

// ==========================================
// AUTOMATIC SERVER FOLDER SYNC API ENDPOINTS
// ==========================================

// GET /api/sync/status (Protected)
app.get('/api/sync/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const status = getServerStatus();
  const tracking = loadFileTracking();
  const recentLog = getSyncLogContent(30);

  const excelFiles = fs.existsSync(EXCEL_PATH)
    ? fs.readdirSync(EXCEL_PATH).filter((f) => (f.endsWith('.xlsx') || f.endsWith('.xls')) && !f.startsWith('~$'))
    : [];

  const photoCount = fs.existsSync(PHOTO_PATH)
    ? fs.readdirSync(PHOTO_PATH).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).length
    : 0;

  res.json({
    status: 'ok',
    storageReady: status.storageReady,
    storagePath: status.storagePath,
    excelFolder: EXCEL_PATH,
    photoFolder: PHOTO_PATH,
    excelFiles,
    excelMaster: status.excelFileName || (excelFiles[0] ?? 'master_pegawai.xlsx'),
    totalEmployees: status.employeeCount,
    totalPhotos: photoCount,
    totalEmbeddings: status.embeddingCount,
    lastSyncTime: status.lastUpdated,
    recentLog,
  });
});

// POST /api/sync/scan (Protected) - Trigger server folder read & sync
app.post('/api/sync/scan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await scanAndSyncServerFiles();
    res.json({
      status: 'ok',
      ...result,
    });
  } catch (err) {
    console.error('Error running server scan:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memindai folder server.' });
  }
});

// POST /api/sync/apply-embeddings (Protected) - Apply newly computed descriptors
app.post('/api/sync/apply-embeddings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { results } = req.body || {};
    if (!Array.isArray(results)) {
      res.status(400).json({ error: 'Array results wajib dicantumkan.' });
      return;
    }

    const syncResult = await applyEmbeddingResults(results);
    res.json({
      status: 'ok',
      ...syncResult,
    });
  } catch (err) {
    console.error('Error applying embeddings:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan embedding wajah.' });
  }
});

// GET /api/sync/log (Protected) - View sync.log
app.get('/api/sync/log', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const log = getSyncLogContent(300);
  res.json({ status: 'ok', log });
});

// GET /api/sync/files (Protected) - List server storage files for inspection
app.get('/api/sync/files', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const excelFiles = fs.existsSync(EXCEL_PATH)
      ? fs.readdirSync(EXCEL_PATH).filter((f) => !f.startsWith('~$')).map((f) => {
          const p = path.join(EXCEL_PATH, f);
          const stat = fs.statSync(p);
          return {
            name: f,
            size: stat.size,
            mtime: stat.mtimeMs,
            path: `/storage/excel/${f}`,
          };
        })
      : [];

    const rawPhotos = fs.existsSync(PHOTO_PATH)
      ? fs.readdirSync(PHOTO_PATH).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      : [];

    // Return first 50 sample photos with status
    const tracking = loadFileTracking();
    const photoSample = rawPhotos.slice(0, 100).map((f) => {
      const p = path.join(PHOTO_PATH, f);
      const stat = fs.statSync(p);
      const track = tracking.photos[f];
      return {
        name: f,
        nomorInduk: path.parse(f).name,
        size: stat.size,
        mtime: stat.mtimeMs,
        status: track?.status || 'ready',
        hasEmbedding: track?.hasEmbedding || false,
      };
    });

    res.json({
      status: 'ok',
      excelFiles,
      totalPhotos: rawPhotos.length,
      photoSample,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal membaca daftar file server.' });
  }
});

// GET & POST /api/settings (Protected)
app.get('/api/settings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const settings = getServerSettings();
  res.json({ status: 'ok', settings });
});

app.post('/api/settings', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  if (req.body && typeof req.body === 'object') {
    saveServerSettings(req.body);
    res.json({ success: true, message: 'Pengaturan server berhasil disimpan.' });
  } else {
    res.status(400).json({ error: 'Format pengaturan tidak valid.' });
  }
});

// GET, POST, DELETE /api/history (Protected)
app.get('/api/history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const logs = getServerLogs();
  res.json({ status: 'ok', logs });
});

app.post('/api/history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.body && typeof req.body === 'object') {
    appendServerLog(req.body);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Format log tidak valid.' });
  }
});

app.delete('/api/history', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  clearServerLogs();
  res.json({ success: true, message: 'Riwayat presensi berhasil dibersihkan.' });
});

// Admin: Upload Excel file
app.post('/api/admin/upload-excel', requireAdmin, upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
  try {
    let fileBuffer: Buffer | null = null;
    let fileName = 'pegawai.xlsx';
    let incomingEmployees: ServerEmployee[] | null = null;

    if (req.file && req.file.buffer) {
      fileBuffer = req.file.buffer;
      fileName = req.file.originalname || 'pegawai.xlsx';
    } else if (req.body && req.body.excelBase64) {
      fileBuffer = Buffer.from(req.body.excelBase64, 'base64');
      if (req.body.fileName) fileName = req.body.fileName;
    }

    if (req.body && req.body.employees) {
      if (Array.isArray(req.body.employees)) {
        incomingEmployees = req.body.employees;
      } else if (typeof req.body.employees === 'string') {
        try {
          incomingEmployees = JSON.parse(req.body.employees);
        } catch (e) {
          console.warn('Failed to parse incoming employees JSON:', e);
        }
      }
    }

    if (fileBuffer) {
      saveMasterExcelFile(fileBuffer, fileName);
    }

    // If client already parsed employees and sent them:
    if (incomingEmployees && incomingEmployees.length > 0) {
      const existing = getAllServerEmployees();
      const existingMap = new Map<string, ServerEmployee>();
      existing.forEach((e) => existingMap.set(e.nomor_induk, e));

      // Upsert: prevent duplicate, update existing, add new, retain old
      for (const emp of incomingEmployees) {
        if (!emp.nomor_induk) continue;
        const prev = existingMap.get(emp.nomor_induk);
        if (prev) {
          existingMap.set(emp.nomor_induk, {
            ...prev,
            ...emp,
            hasPhoto: prev.hasPhoto || emp.hasPhoto,
            photoFileName: prev.photoFileName || emp.photoFileName,
            photoUrl: prev.photoUrl || emp.photoUrl,
            faceDescriptor: prev.faceDescriptor || emp.faceDescriptor,
            photoStatus: prev.photoStatus !== 'no_photo' ? prev.photoStatus : emp.photoStatus,
            extraFields: { ...(prev.extraFields || {}), ...(emp.extraFields || {}) },
            updatedAt: Date.now(),
          });
        } else {
          existingMap.set(emp.nomor_induk, {
            ...emp,
            updatedAt: Date.now(),
          });
        }
      }

      const merged = Array.from(existingMap.values());
      saveServerEmployees(merged);
      const status = getServerStatus();
      res.json({
        success: true,
        message: `Berhasil mengunggah dan menyimpan ${merged.length} data pegawai ke server master.`,
        employeeCount: merged.length,
        version: status.version,
      });
      return;
    }

    // If only fileBuffer was sent, parse it directly on the server!
    if (fileBuffer) {
      const rawRows = parseExcelBuffer(fileBuffer);
      if (rawRows.length > 0) {
        const existing = getAllServerEmployees();
        const existingMap = new Map<string, ServerEmployee>();
        existing.forEach((e) => existingMap.set(e.nomor_induk, e));

        const parsedList: ServerEmployee[] = [];
        for (const row of rawRows) {
          // Detect primary key
          const rawId = (row['NOMOR INDUK'] || row['Nomor Induk'] || row['NIP'] || row['ID'] || row['nomor_induk'] || '') as string;
          const rawName = (row['NAMA LENGKAP'] || row['Nama Lengkap'] || row['NAMA'] || row['Nama'] || row['nama'] || '') as string;

          const nomorInduk = String(rawId).trim();
          const nama = String(rawName).trim();
          if (!nomorInduk || !nama) continue;

          const prev = existingMap.get(nomorInduk);
          parsedList.push({
            nomor_induk: nomorInduk,
            nama,
            nip: String(row['NIP'] || row['Nip'] || '').trim() || undefined,
            jabatan: String(row['JABATAN'] || row['Jabatan'] || '').trim() || undefined,
            pangkat_golongan: String(row['PANGKAT'] || row['Golongan'] || row['PANGKAT / GOL'] || '').trim() || undefined,
            unit_kerja: String(row['UNIT KERJA'] || row['Unit Kerja'] || '').trim() || undefined,
            instansi: String(row['INSTANSI'] || row['Instansi'] || '').trim() || undefined,
            hasPhoto: prev ? prev.hasPhoto : false,
            photoFileName: prev ? prev.photoFileName : undefined,
            photoUrl: prev ? prev.photoUrl : undefined,
            faceDescriptor: prev ? prev.faceDescriptor : undefined,
            photoStatus: prev ? prev.photoStatus : 'no_photo',
            updatedAt: Date.now(),
          });
        }

        if (parsedList.length > 0) {
          saveServerEmployees(parsedList);
          const status = getServerStatus();
          res.json({
            success: true,
            message: `Berhasil memproses ${parsedList.length} data pegawai dari Excel di server.`,
            employeeCount: parsedList.length,
            version: status.version,
          });
          return;
        }
      }
    }

    res.status(400).json({ error: 'Tidak ada data pegawai yang valid ditemukan di file Excel.' });
  } catch (err: unknown) {
    console.error('Error uploading excel:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memproses file Excel di server.' });
  }
});

// Admin: Upload Photos (Batch base64 or multipart)
app.post('/api/admin/upload-photos', requireAdmin, upload.array('photos', 500), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { photos } = req.body || {};
    let processedCount = 0;
    const newEmbeddings: Record<string, number[]> = {};

    // 1. If sent as JSON batch { photos: [{ nomorInduk, base64, descriptor, fileName }] }
    if (Array.isArray(photos)) {
      for (const item of photos) {
        if (!item.nomorInduk) continue;
        const nomorInduk = String(item.nomorInduk).trim();

        if (item.base64) {
          const cleanB64 = item.base64.replace(/^data:image\/\w+;base64,/, '');
          const buf = Buffer.from(cleanB64, 'base64');
          savePhotoFile(nomorInduk, buf, 'jpg');
          processedCount++;
        }

        if (Array.isArray(item.descriptor) && item.descriptor.length > 0) {
          newEmbeddings[nomorInduk] = item.descriptor;
        }
      }
    }

    // 2. If sent as multipart files
    const files = req.files as Express.Multer.File[];
    if (files && Array.isArray(files)) {
      for (const file of files) {
        const baseName = path.basename(file.originalname, path.extname(file.originalname));
        const ext = (path.extname(file.originalname).replace('.', '') || 'jpg').toLowerCase();
        savePhotoFile(baseName, file.buffer, ext);
        processedCount++;
      }
    }

    if (Object.keys(newEmbeddings).length > 0) {
      saveEmbeddings(newEmbeddings);
    }

    // Update photoStatus and photoUrl for employees in pegawai.json
    const employees = getAllServerEmployees();
    let empUpdated = false;
    for (const emp of employees) {
      const hasPhotoFile = Boolean(getPhotoFilePath(emp.nomor_induk));
      if (hasPhotoFile) {
        if (!emp.hasPhoto || emp.photoStatus === 'no_photo' || !emp.photoUrl) {
          emp.hasPhoto = true;
          emp.photoFileName = `${emp.nomor_induk}.jpg`;
          emp.photoUrl = `/api/photos/${emp.nomor_induk}`;
          emp.photoStatus = 'ready';
          empUpdated = true;
        }
      }
    }
    if (empUpdated) {
      saveServerEmployees(employees);
    }

    const status = getServerStatus();
    res.json({
      success: true,
      message: `Berhasil menyimpan ${processedCount} foto ke storage server.`,
      processedCount,
      version: status.version,
    });
  } catch (err: unknown) {
    console.error('Error uploading photos:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan foto ke server.' });
  }
});

// Admin: Save Embeddings batch
app.post('/api/admin/save-embeddings', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { embeddings } = req.body || {};
    if (!embeddings || typeof embeddings !== 'object') {
      res.status(400).json({ error: 'Format embeddings tidak valid.' });
      return;
    }

    saveEmbeddings(embeddings);
    const status = getServerStatus();
    res.json({
      success: true,
      message: `Berhasil memperbarui ${Object.keys(embeddings).length} face embedding di server.`,
      embeddingCount: status.embeddingCount,
      version: status.version,
    });
  } catch (err: unknown) {
    console.error('Error saving embeddings:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan face embedding.' });
  }
});

// Admin: Sync All to Server (Migration of existing client data to server master storage)
app.post('/api/admin/sync-all-to-server', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employees, embeddings, settings, logs, photos } = req.body || {};

    if (photos && typeof photos === 'object') {
      for (const [nomorInduk, b64] of Object.entries(photos)) {
        if (typeof b64 === 'string') {
          const cleanB64 = b64.replace(/^data:image\/\w+;base64,/, '');
          const buf = Buffer.from(cleanB64, 'base64');
          savePhotoFile(nomorInduk, buf, 'jpg');
        }
      }
    }

    if (embeddings && typeof embeddings === 'object') {
      saveEmbeddings(embeddings);
    }

    if (Array.isArray(employees) && employees.length > 0) {
      const existing = getAllServerEmployees();
      const existingMap = new Map<string, ServerEmployee>();
      existing.forEach((e) => existingMap.set(e.nomor_induk, e));

      for (const emp of employees) {
        if (!emp.nomor_induk) continue;
        const prev = existingMap.get(emp.nomor_induk);
        const hasPhotoFile = Boolean(getPhotoFilePath(emp.nomor_induk));
        if (prev) {
          existingMap.set(emp.nomor_induk, {
            ...prev,
            ...emp,
            hasPhoto: prev.hasPhoto || emp.hasPhoto || hasPhotoFile,
            photoFileName: prev.photoFileName || emp.photoFileName || (hasPhotoFile ? `${emp.nomor_induk}.jpg` : undefined),
            photoUrl: `/api/photos/${emp.nomor_induk}`,
            faceDescriptor: emp.faceDescriptor || prev.faceDescriptor,
            photoStatus: emp.photoStatus !== 'no_photo' ? emp.photoStatus : prev.photoStatus,
            extraFields: { ...(prev.extraFields || {}), ...(emp.extraFields || {}) },
            updatedAt: Date.now(),
          });
        } else {
          existingMap.set(emp.nomor_induk, {
            ...emp,
            hasPhoto: emp.hasPhoto || hasPhotoFile,
            photoFileName: emp.photoFileName || (hasPhotoFile ? `${emp.nomor_induk}.jpg` : undefined),
            photoUrl: `/api/photos/${emp.nomor_induk}`,
            updatedAt: Date.now(),
          });
        }
      }
      saveServerEmployees(Array.from(existingMap.values()));
    }

    if (settings && typeof settings === 'object') {
      saveServerSettings(settings);
    }

    if (Array.isArray(logs) && logs.length > 0) {
      for (const item of logs.slice().reverse()) {
        appendServerLog(item);
      }
    }

    const status = getServerStatus();
    res.json({
      success: true,
      message: 'Seluruh database lokal berhasil disinkronkan & disimpan permanen ke server master!',
      status,
    });
  } catch (err: unknown) {
    console.error('Error syncing all to server:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal sinkronisasi data ke server.' });
  }
});

// Admin: Rebuild embeddings / metadata check
app.post('/api/admin/rebuild-embeddings', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = getServerStatus();
    res.json({
      success: true,
      message: 'Status embedding server diverifikasi.',
      status,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memverifikasi embedding.' });
  }
});

// Admin: Create persistent database backup
app.post('/api/admin/backup', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const backup = createBackup();
    res.json({
      success: true,
      message: `Backup ${backup.fileName} berhasil dibuat di server.`,
      backup,
    });
  } catch (err: unknown) {
    console.error('Error creating backup:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal membuat backup database.' });
  }
});

// Admin: List all backups
app.get('/api/admin/backups', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const backups = listBackups();
    res.json({ status: 'ok', backups });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengambil daftar backup.' });
  }
});

// Admin: Restore database from backup
app.post('/api/admin/restore', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { backupId } = req.body || {};
    if (!backupId) {
      res.status(400).json({ error: 'ID backup wajib dicantumkan.' });
      return;
    }

    const restored = restoreBackup(backupId);
    if (!restored) {
      res.status(404).json({ error: 'Berkas backup tidak ditemukan atau gagal dibaca.' });
      return;
    }

    const status = getServerStatus();
    res.json({
      success: true,
      message: 'Database server berhasil dipulihkan dari backup.',
      status,
    });
  } catch (err: unknown) {
    console.error('Error restoring backup:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memulihkan backup database.' });
  }
});

// Admin: Reset database
app.delete('/api/admin/database', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    resetServerDatabase();
    res.json({ success: true, message: 'Database server berhasil direset.' });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mereset database server.' });
  }
});

// Ensure any unhandled API routes return a structured JSON response instead of HTML or empty
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: `Endpoint API '${req.method} ${req.path}' tidak ditemukan di server.`,
  });
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

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[SERVER] Face Recognition server running on http://0.0.0.0:${PORT}`);
    console.log(`[AUTH] Session timeout configured to: ${SESSION_DURATION_MS / (1000 * 60 * 60)} hours.`);
    console.log(`[STORAGE] Storage root: ${STORAGE_PATH}`);
    console.log(`[STORAGE] Excel folder: ${EXCEL_PATH}`);
    console.log(`[STORAGE] Photos folder: ${PHOTO_PATH}`);

    // Initial folder scan on startup
    try {
      console.log('[STARTUP] Memindai folder /storage/excel/ dan /storage/photos/...');
      const initResult = await scanAndSyncServerFiles();
      console.log(`[STARTUP] Sinkronisasi selesai: ${initResult.totalEmployees} pegawai, ${initResult.totalPhotos} foto, ${initResult.totalEmbeddings} embedding.`);
    } catch (err) {
      console.error('[STARTUP] Gagal sinkronisasi awal folder server:', err);
    }

    // Filesystem watchers with debouncing
    let syncDebounceTimer: NodeJS.Timeout | null = null;
    const triggerDebouncedSync = (source: string) => {
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      syncDebounceTimer = setTimeout(async () => {
        try {
          console.log(`[WATCHER] Perubahan file terdeteksi pada ${source}, menjalankan sinkronisasi otomatis...`);
          await scanAndSyncServerFiles();
        } catch (err) {
          console.error('[WATCHER] Gagal sinkronisasi otomatis:', err);
        }
      }, 2000);
    };

    if (fs.existsSync(EXCEL_PATH)) {
      try {
        fs.watch(EXCEL_PATH, (eventType, filename) => {
          if (filename && !filename.startsWith('~$')) {
            triggerDebouncedSync(`folder excel (${filename})`);
          }
        });
        console.log('[WATCHER] Filesystem watcher aktif pada /storage/excel/');
      } catch (e) {
        console.warn('[WATCHER] Gagal mengaktifkan watch pada folder excel:', e);
      }
    }

    if (fs.existsSync(PHOTO_PATH)) {
      try {
        fs.watch(PHOTO_PATH, (eventType, filename) => {
          if (filename && !filename.startsWith('.')) {
            triggerDebouncedSync(`folder photos (${filename})`);
          }
        });
        console.log('[WATCHER] Filesystem watcher aktif pada /storage/photos/');
      } catch (e) {
        console.warn('[WATCHER] Gagal mengaktifkan watch pada folder photos:', e);
      }
    }

    // Scheduled background check every 30 seconds
    setInterval(async () => {
      try {
        await scanAndSyncServerFiles();
      } catch {
        // ignore background interval errors
      }
    }, 30000);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
