/**
 * Face Recognition Service using @vladmandic/face-api
 * Local browser inference: models loaded from /models
 */
import * as faceapi from '@vladmandic/face-api';
import { Employee, DetectedFaceResult } from '../types';
import { euclideanDistance, distanceToConfidence } from '../utils/similarity';
import { optimizeImageForDetection, createThumbnailDataUrl } from './imageProcessor';

let modelsLoaded = false;
let modelLoadingPromise: Promise<void> | null = null;
let currentDetectorType: 'ssdMobilenetv1' | 'tinyFaceDetector' = 'ssdMobilenetv1';

export type ModelLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Load face-api neural network models
 */
export async function loadFaceModels(
  onProgress?: (step: string, percent: number) => void
): Promise<void> {
  if (modelsLoaded) return;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      const modelPath = '/models';
      onProgress?.('Memuat model SSD Mobilenet V1...', 20);

      // Try local /models first
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);
      } catch (localErr) {
        console.warn('Local model load failed, falling back to CDN:', localErr);
        await faceapi.nets.ssdMobilenetv1.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
      }

      onProgress?.('Memuat model Tiny Face Detector...', 40);
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
      } catch {
        await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
      }

      onProgress?.('Memuat model Face Landmark 68...', 65);
      try {
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      } catch {
        await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
      }

      onProgress?.('Memuat model Face Recognition ResNet...', 90);
      try {
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      } catch {
        await faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
      }

      modelsLoaded = true;
      onProgress?.('Model AI Face Recognition siap digunakan.', 100);
    } catch (error) {
      console.error('Fatal error loading face models:', error);
      modelsLoaded = false;
      modelLoadingPromise = null;
      throw new Error('Gagal memuat model face recognition: ' + (error instanceof Error ? error.message : String(error)));
    }
  })();

  return modelLoadingPromise;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

/**
 * Process a single image file for employee database:
 * 1. Resizes if needed
 * 2. Detects faces
 * 3. Extracts 128-d descriptor embedding
 * 4. Generates thumbnail
 */
export async function processEmployeePhoto(imgElement: HTMLImageElement): Promise<{
  status: 'ready' | 'no_face' | 'multi_face' | 'error';
  descriptor?: number[];
  faceCount: number;
  errorMessage?: string;
  thumbnailUrl: string;
}> {
  if (!modelsLoaded) {
    await loadFaceModels();
  }

  const { canvas } = optimizeImageForDetection(imgElement, 800);
  const thumbnailUrl = createThumbnailDataUrl(canvas, 180);

  try {
    // Detect all faces with landmarks and descriptors
    const detections = await faceapi
      .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections || detections.length === 0) {
      return {
        status: 'no_face',
        faceCount: 0,
        errorMessage: 'Foto tidak memiliki wajah yang terdeteksi. Pastikan wajah tegak lurus dan pencahayaan cukup.',
        thumbnailUrl,
      };
    }

    if (detections.length > 1) {
      // Find the largest face by bounding box area
      let largestFace = detections[0];
      let maxArea = largestFace.detection.box.width * largestFace.detection.box.height;
      for (let i = 1; i < detections.length; i++) {
        const area = detections[i].detection.box.width * detections[i].detection.box.height;
        if (area > maxArea) {
          maxArea = area;
          largestFace = detections[i];
        }
      }

      return {
        status: 'multi_face',
        descriptor: Array.from(largestFace.descriptor),
        faceCount: detections.length,
        errorMessage: `Terdeteksi ${detections.length} wajah. Wajah terbesar dipilih sebagai embedding.`,
        thumbnailUrl,
      };
    }

    // Exactly 1 face
    const primaryFace = detections[0];
    return {
      status: 'ready',
      descriptor: Array.from(primaryFace.descriptor),
      faceCount: 1,
      thumbnailUrl,
    };
  } catch (err) {
    return {
      status: 'error',
      faceCount: 0,
      errorMessage: 'Gagal memproses embedding foto: ' + (err instanceof Error ? err.message : String(err)),
      thumbnailUrl,
    };
  }
}

/**
 * Extract face embedding descriptor directly from an image URL
 */
export async function extractEmbeddingFromUrl(photoUrl: string): Promise<{
  status: 'ready' | 'no_face' | 'multi_face' | 'low_quality' | 'error';
  descriptor?: number[];
  errorMessage?: string;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const res = await processEmployeePhoto(img);
        resolve({
          status: res.status as any,
          descriptor: res.descriptor,
          errorMessage: res.errorMessage,
        });
      } catch (err) {
        resolve({
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    };
    img.onerror = () => {
      resolve({
        status: 'error',
        errorMessage: 'Gagal memuat file foto dari server.',
      });
    };
    img.src = photoUrl;
  });
}

/**
 * Recognize all faces in a live video frame
 */
export async function detectAndRecognizeFaces(
  video: HTMLVideoElement,
  employees: Employee[],
  threshold = 0.50,
  detectorType: 'ssdMobilenetv1' | 'tinyFaceDetector' = 'ssdMobilenetv1'
): Promise<DetectedFaceResult[]> {
  if (!modelsLoaded || video.readyState < 2) {
    return [];
  }

  currentDetectorType = detectorType;
  const options =
    detectorType === 'tinyFaceDetector'
      ? new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 })
      : new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

  const detections = await faceapi
    .detectAllFaces(video, options)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (!detections || detections.length === 0) {
    return [];
  }

  // Pre-filter employees who have valid embeddings
  const validEmployees = employees.filter(e => e.faceDescriptor && e.faceDescriptor.length === 128);

  const results: DetectedFaceResult[] = [];

  for (const detection of detections) {
    const box = {
      x: detection.detection.box.x,
      y: detection.detection.box.y,
      width: detection.detection.box.width,
      height: detection.detection.box.height,
    };

    const queryDescriptor = detection.descriptor;
    let bestMatchEmployee: Employee | undefined = undefined;
    let minDistance = Infinity;

    // Compare with all database embeddings
    for (const emp of validEmployees) {
      if (!emp.faceDescriptor) continue;
      const dist = euclideanDistance(queryDescriptor, emp.faceDescriptor);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatchEmployee = emp;
      }
    }

    const confidence = distanceToConfidence(minDistance);
    const isRecognized = minDistance <= threshold && !!bestMatchEmployee;

    // Basic liveness estimation: check eye aspect ratio (EAR) from 68 landmarks
    let livenessPassed = true;
    try {
      const landmarks = detection.landmarks.positions;
      // Left eye landmarks: 36-41, Right eye: 42-47
      if (landmarks && landmarks.length >= 48) {
        // EAR calculation
        const leftEar = calculateEAR(landmarks, 36);
        const rightEar = calculateEAR(landmarks, 42);
        // If eyes are natural open/closed values (between 0.12 and 0.45)
        livenessPassed = leftEar > 0.10 && rightEar > 0.10;
      }
    } catch {
      livenessPassed = true;
    }

    results.push({
      box,
      descriptor: queryDescriptor,
      employee: isRecognized ? bestMatchEmployee : undefined,
      confidence,
      distance: minDistance === Infinity ? 1.0 : Math.round(minDistance * 1000) / 1000,
      isRecognized,
      livenessPassed,
    });
  }

  return results;
}

/**
 * Calculate Eye Aspect Ratio (EAR) for simple liveness check
 */
function calculateEAR(points: faceapi.Point[], startIndex: number): number {
  const p1 = points[startIndex];
  const p2 = points[startIndex + 1];
  const p3 = points[startIndex + 2];
  const p4 = points[startIndex + 3];
  const p5 = points[startIndex + 4];
  const p6 = points[startIndex + 5];

  const distVertical1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const distVertical2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const distHorizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y);

  if (distHorizontal === 0) return 0.25;
  return (distVertical1 + distVertical2) / (2.0 * distHorizontal);
}

/**
 * Temporal Confirmation Buffer to eliminate false positives
 * Requires at least `minMatches` out of last `windowSize` (e.g. 3 of 5)
 */
export class TemporalConfirmationTracker {
  private windowSize: number;
  private minMatches: number;
  private history: Map<string, string[]> = new Map(); // key = slot index or spatial cluster -> history of employee IDs

  constructor(windowSize = 5, minMatches = 3) {
    this.windowSize = windowSize;
    this.minMatches = minMatches;
  }

  public updateParameters(windowSize: number, minMatches: number) {
    this.windowSize = windowSize;
    this.minMatches = minMatches;
  }

  /**
   * Process results and determine if confirmed
   */
  public evaluate(results: DetectedFaceResult[]): DetectedFaceResult[] {
    return results.map((res, index) => {
      const slotKey = `face_${index}`;
      let historyList = this.history.get(slotKey) || [];

      const currentId = res.isRecognized && res.employee ? res.employee.nomor_induk : 'unrecognized';
      historyList.push(currentId);

      if (historyList.length > this.windowSize) {
        historyList = historyList.slice(-this.windowSize);
      }
      this.history.set(slotKey, historyList);

      if (res.isRecognized && res.employee) {
        const matchesCount = historyList.filter(id => id === res.employee!.nomor_induk).length;
        const isConfirmed = matchesCount >= this.minMatches;

        return {
          ...res,
          consecutiveMatches: matchesCount,
          isConfirmed,
        };
      }

      return {
        ...res,
        consecutiveMatches: 0,
        isConfirmed: false,
      };
    });
  }

  public reset() {
    this.history.clear();
  }
}

/**
 * Pleasant Web Audio API notification sound for verified face recognition
 */
export function playRecognitionChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Chord: E5 (659.25Hz) and B5 (987.77Hz)
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(659.25, now, 0.22);
    playTone(987.77, now + 0.08, 0.35);
  } catch (e) {
    // AudioContext autoplay restrictions or error
    console.debug('Audio chime playback omitted:', e);
  }
}

export interface ImageFaceRecognitionResult {
  faceIndex: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  detectionScore: number;
  descriptor: Float32Array;
  employee?: Employee;
  bestCandidate?: {
    employee: Employee;
    confidence: number;
    distance: number;
  };
  confidence: number;
  distance: number;
  isRecognized: boolean;
  croppedFaceUrl?: string;
  qualityIssues: string[];
}

/**
 * Identify all faces from a static image or canvas.
 * Utilizes the exact same face recognition models & master server embeddings.
 */
export async function identifyFacesInImage(
  imageOrCanvas: HTMLImageElement | HTMLCanvasElement,
  employees: Employee[],
  threshold = 0.50
): Promise<{
  faces: ImageFaceRecognitionResult[];
  imageWidth: number;
  imageHeight: number;
  noFaceDetected: boolean;
  totalFaces: number;
}> {
  if (!modelsLoaded) {
    await loadFaceModels();
  }

  // Determine width & height
  const width = 'naturalWidth' in imageOrCanvas ? imageOrCanvas.naturalWidth : imageOrCanvas.width;
  const height = 'naturalHeight' in imageOrCanvas ? imageOrCanvas.naturalHeight : imageOrCanvas.height;

  // Detect all faces using SSD Mobilenet V1
  const detections = await faceapi
    .detectAllFaces(imageOrCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (!detections || detections.length === 0) {
    return {
      faces: [],
      imageWidth: width,
      imageHeight: height,
      noFaceDetected: true,
      totalFaces: 0,
    };
  }

  const validEmployees = employees.filter((e) => e.faceDescriptor && e.faceDescriptor.length === 128);

  const results: ImageFaceRecognitionResult[] = [];

  // Temporary canvas to crop face regions
  const cropCanvas = document.createElement('canvas');
  const cropCtx = cropCanvas.getContext('2d');

  for (let idx = 0; idx < detections.length; idx++) {
    const det = detections[idx];
    const box = {
      x: Math.max(0, Math.round(det.detection.box.x)),
      y: Math.max(0, Math.round(det.detection.box.y)),
      width: Math.round(det.detection.box.width),
      height: Math.round(det.detection.box.height),
    };

    const qualityIssues: string[] = [];

    // Check 1: Wajah terlalu kecil
    if (box.width < 50 || box.height < 50) {
      qualityIssues.push('Ukuran wajah terlalu kecil (< 50px)');
    }

    // Check 2: Confidence detektor rendah (indikasi foto buram / miring)
    const detScore = det.detection.score;
    if (detScore < 0.55) {
      qualityIssues.push('Wajah kurang fokus / deteksi rendah');
    }

    // Crop face for display
    let croppedFaceUrl: string | undefined = undefined;
    if (cropCtx && width > 0 && height > 0) {
      try {
        const padX = Math.round(box.width * 0.15);
        const padY = Math.round(box.height * 0.2);
        const cropX = Math.max(0, box.x - padX);
        const cropY = Math.max(0, box.y - padY);
        const cropW = Math.min(width - cropX, box.width + padX * 2);
        const cropH = Math.min(height - cropY, box.height + padY * 2);

        cropCanvas.width = 160;
        cropCanvas.height = 200;
        cropCtx.clearRect(0, 0, 160, 200);
        cropCtx.drawImage(imageOrCanvas, cropX, cropY, cropW, cropH, 0, 0, 160, 200);

        // Check 3: Luminance / pencahayaan
        try {
          const imgData = cropCtx.getImageData(0, 0, 160, 200);
          let totalLuminance = 0;
          const pixelCount = imgData.data.length / 4;
          for (let p = 0; p < imgData.data.length; p += 16) {
            const r = imgData.data[p];
            const g = imgData.data[p + 1];
            const b = imgData.data[p + 2];
            totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
          }
          const avgLum = totalLuminance / (pixelCount / 4);
          if (avgLum < 32) {
            qualityIssues.push('Pencahayaan wajah terlalu gelap');
          }
        } catch {
          // Ignore pixel inspection error
        }

        croppedFaceUrl = cropCanvas.toDataURL('image/jpeg', 0.85);
      } catch (cropErr) {
        console.warn('Face crop generation skipped:', cropErr);
      }
    }

    // Compare with Master Server database embeddings
    const queryDescriptor = det.descriptor;
    let bestEmployee: Employee | undefined = undefined;
    let minDistance = Infinity;

    for (const emp of validEmployees) {
      if (!emp.faceDescriptor) continue;
      const dist = euclideanDistance(queryDescriptor, emp.faceDescriptor);
      if (dist < minDistance) {
        minDistance = dist;
        bestEmployee = emp;
      }
    }

    const confidence = distanceToConfidence(minDistance);
    const isRecognized = minDistance <= threshold && !!bestEmployee;

    results.push({
      faceIndex: idx,
      box,
      detectionScore: Math.round(detScore * 100) / 100,
      descriptor: queryDescriptor,
      employee: isRecognized ? bestEmployee : undefined,
      bestCandidate: bestEmployee
        ? {
            employee: bestEmployee,
            confidence,
            distance: minDistance === Infinity ? 1.0 : Math.round(minDistance * 1000) / 1000,
          }
        : undefined,
      confidence,
      distance: minDistance === Infinity ? 1.0 : Math.round(minDistance * 1000) / 1000,
      isRecognized,
      croppedFaceUrl,
      qualityIssues,
    });
  }

  return {
    faces: results,
    imageWidth: width,
    imageHeight: height,
    noFaceDetected: false,
    totalFaces: results.length,
  };
}
