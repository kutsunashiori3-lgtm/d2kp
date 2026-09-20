/**
 * Recognition Logger Service with cooldown anti-spam mechanism
 */
import { Employee, RecognitionLog } from '../types';
import { addRecognitionLog } from './database';

class RecognitionLogger {
  private lastLoggedMap: Map<string, number> = new Map(); // nomor_induk -> last timestamp (ms)
  private cooldownMs: number = 5000; // default 5 seconds
  private onLogListeners: ((log: RecognitionLog) => void)[] = [];

  public setCooldownSeconds(seconds: number) {
    this.cooldownMs = seconds * 1000;
  }

  public subscribe(listener: (log: RecognitionLog) => void): () => void {
    this.onLogListeners.push(listener);
    return () => {
      this.onLogListeners = this.onLogListeners.filter(l => l !== listener);
    };
  }

  public async logRecognition(
    employee: Employee,
    confidence: number,
    distance: number
  ): Promise<boolean> {
    const now = Date.now();
    const lastTime = this.lastLoggedMap.get(employee.nomor_induk) || 0;

    if (now - lastTime < this.cooldownMs) {
      // Cooldown active, don't write duplicate log
      return false;
    }

    this.lastLoggedMap.set(employee.nomor_induk, now);

    const dateObj = new Date(now);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    const log: RecognitionLog = {
      id: `${now}_${employee.nomor_induk}`,
      timestamp: now,
      dateStr: `${day}-${month}-${year}`,
      timeStr: `${hours}:${minutes}:${seconds}`,
      nomor_induk: employee.nomor_induk,
      nama: employee.nama,
      nip: employee.nip,
      jabatan: employee.jabatan,
      unit_kerja: employee.unit_kerja || '-',
      instansi: employee.instansi || '-',
      confidence,
      distance,
      status: 'Recognized',
      photoUrl: employee.photoUrl,
    };

    await addRecognitionLog(log);

    // Notify UI
    this.onLogListeners.forEach(listener => {
      try {
        listener(log);
      } catch (e) {
        console.error('Error in log listener:', e);
      }
    });

    return true;
  }
}

export const recognitionLogger = new RecognitionLogger();
