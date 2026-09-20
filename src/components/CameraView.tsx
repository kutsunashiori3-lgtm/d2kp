/**
 * Camera View component handling live webcam feed, real-time face detection loop,
 * multi-frame confirmation, audio feedback, and fullscreen kiosk mode.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Employee, DetectedFaceResult, AppSettings } from '../types';
import {
  detectAndRecognizeFaces,
  loadFaceModels,
  areModelsLoaded,
  TemporalConfirmationTracker,
  playRecognitionChime,
} from '../services/faceRecognition';
import { recognitionLogger } from '../services/recognitionLogger';
import { FaceOverlay } from './FaceOverlay';
import { EmployeeCard } from './EmployeeCard';
import {
  Camera,
  CameraOff,
  Maximize,
  Minimize,
  RefreshCw,
  AlertCircle,
  Volume2,
  VolumeX,
  FlipHorizontal,
  Clock,
  Calendar,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface CameraViewProps {
  employees: Employee[];
  settings: AppSettings;
  onNavigateToImport?: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  employees,
  settings,
  onNavigateToImport,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isDetectingRef = useRef<boolean>(false);
  const lastDetectTimeRef = useRef<number>(0);
  const trackerRef = useRef<TemporalConfirmationTracker>(
    new TemporalConfirmationTracker(5, settings.confirmationFrames || 3)
  );

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(!areModelsLoaded());
  const [modelLoadingText, setModelLoadingText] = useState<string>('Memeriksa model AI...');
  const [modelLoadingProgress, setModelLoadingProgress] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(settings.selectedCameraId || '');
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(settings.beepOnRecognize);

  // Live detection state
  const [detectedFaces, setDetectedFaces] = useState<DetectedFaceResult[]>([]);
  const [fps, setFps] = useState<number>(0);
  const fpsCounterRef = useRef<{ count: number; lastTime: number }>({ count: 0, lastTime: performance.now() });

  // Digital clock for kiosk mode
  const [currentDateTime, setCurrentDateTime] = useState<{ time: string; date: string }>({
    time: '',
    date: '',
  });

  // Keep tracker parameters in sync with settings
  useEffect(() => {
    trackerRef.current.updateParameters(5, settings.confirmationFrames || 3);
  }, [settings.confirmationFrames]);

  // Clock updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      setCurrentDateTime({ time: timeStr, date: dateStr });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Pre-load AI models
  useEffect(() => {
    let isMounted = true;
    if (!areModelsLoaded()) {
      setIsModelLoading(true);
      loadFaceModels((step, progress) => {
        if (isMounted) {
          setModelLoadingText(step);
          setModelLoadingProgress(progress);
        }
      })
        .then(() => {
          if (isMounted) {
            setIsModelLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setIsModelLoading(false);
            setCameraError('Gagal memuat model pengenalan wajah: ' + (err instanceof Error ? err.message : String(err)));
          }
        });
    } else {
      setIsModelLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Enumerate video devices
  const loadVideoDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch {
      // ignore
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    loadVideoDevices();
  }, [loadVideoDevices]);

  // Start webcam
  const startCamera = async (deviceId?: string) => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser Anda tidak mendukung akses kamera (getUserMedia).');
      }

      // Stop any existing stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }

      const targetDeviceId = deviceId || selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        loadVideoDevices();
      }
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      let message = 'Tidak dapat mengakses kamera.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Izin kamera ditolak. Berikan izin kamera di pengaturan browser Anda.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'Kamera tidak ditemukan pada perangkat Anda.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          message = 'Kamera sedang digunakan oleh aplikasi lain.';
        } else {
          message = err.message;
        }
      }
      setCameraError(message);
      setIsCameraActive(false);
    }
  };

  // Stop webcam
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setDetectedFaces([]);
    trackerRef.current.reset();
  }, []);

  // Detection loop
  useEffect(() => {
    if (!isCameraActive || isModelLoading) return;

    let active = true;
    const intervalMs = settings.detectionIntervalMs || 150;

    const runDetection = async () => {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) {
        if (active) {
          animationFrameRef.current = requestAnimationFrame(runDetection);
        }
        return;
      }

      const now = performance.now();
      if (!isDetectingRef.current && now - lastDetectTimeRef.current >= intervalMs) {
        isDetectingRef.current = true;
        lastDetectTimeRef.current = now;

        try {
          // Detect all faces with landmarks and descriptors
          const rawResults = await detectAndRecognizeFaces(
            videoRef.current,
            employees,
            settings.matchThreshold,
            settings.detectorType
          );

          if (active) {
            // Apply temporal confirmation filter (3 of 5 frames required)
            const confirmedResults = trackerRef.current.evaluate(rawResults);
            setDetectedFaces(confirmedResults);

            // Trigger log and audio chime for newly confirmed faces
            for (const res of confirmedResults) {
              if (res.isRecognized && res.isConfirmed && res.employee) {
                const logged = await recognitionLogger.logRecognition(
                  res.employee,
                  res.confidence || 0,
                  res.distance || 0
                );
                if (logged && soundEnabled) {
                  playRecognitionChime();
                }
              }
            }

            // Update FPS estimation
            fpsCounterRef.current.count++;
            const timeSinceFps = now - fpsCounterRef.current.lastTime;
            if (timeSinceFps >= 1000) {
              setFps(Math.round((fpsCounterRef.current.count * 1000) / timeSinceFps));
              fpsCounterRef.current.count = 0;
              fpsCounterRef.current.lastTime = now;
            }
          }
        } catch (err) {
          console.error('Frame recognition error:', err);
        } finally {
          isDetectingRef.current = false;
        }
      }

      if (active) {
        animationFrameRef.current = requestAnimationFrame(runDetection);
      }
    };

    animationFrameRef.current = requestAnimationFrame(runDetection);

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isCameraActive, isModelLoading, employees, settings, soundEnabled]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Primary recognized employee (if any)
  const primaryFace = detectedFaces[0];
  const primaryStatus =
    detectedFaces.length === 0
      ? 'no_face'
      : primaryFace?.isRecognized
      ? primaryFace.isConfirmed
        ? 'recognized'
        : 'verifying'
      : 'unrecognized';

  const readyEmployeesCount = employees.filter((e) => e.faceDescriptor && e.faceDescriptor.length > 0).length;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 text-white p-4 md:p-6' : 'w-full'
      }`}
    >
      {/* Top Banner & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              Live Camera Recognition
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isCameraActive
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isCameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              {isCameraActive ? 'Kamera Aktif' : 'Kamera Standby'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Database Terhubung: <span className="font-semibold text-slate-700">{readyEmployeesCount}</span> wajah siap dikenali
          </p>
        </div>

        {/* Quick Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Device selector */}
          {availableDevices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                if (isCameraActive) {
                  startCamera(e.target.value);
                }
              }}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableDevices.map((device, idx) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Kamera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          {/* Mirror toggle */}
          <button
            type="button"
            onClick={() => setIsMirrored(!isMirrored)}
            title="Cerminkan Kamera (Mirror)"
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
              isMirrored
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          {/* Audio Chime toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Suara Chime Aktif' : 'Suara Dimatikan'}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
              soundEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Fullscreen Kiosk Mode */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Mode Layar Penuh (Kiosk)"
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs flex items-center gap-1"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span className="hidden sm:inline">Mode Kiosk</span>
          </button>

          {/* Start / Stop Camera Button */}
          {!isCameraActive ? (
            <button
              type="button"
              onClick={() => startCamera()}
              disabled={isModelLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-xs rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            >
              <Camera className="w-4 h-4" />
              Mulai Kamera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            >
              <CameraOff className="w-4 h-4" />
              Hentikan Kamera
            </button>
          )}
        </div>
      </div>

      {/* Model loading alert */}
      {isModelLoading && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-900 mb-1">
              <span>{modelLoadingText}</span>
              <span>{modelLoadingProgress}%</span>
            </div>
            <div className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${modelLoadingProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Camera error message */}
      {cameraError && (
        <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900">
            <h4 className="font-semibold text-sm text-rose-950 mb-1">Kamera Bermasalah</h4>
            <p>{cameraError}</p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Coba Lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning if no embeddings loaded yet */}
      {readyEmployeesCount === 0 && !isModelLoading && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs text-amber-900">
              <span className="font-bold">Database Wajah Masih Kosong:</span> Belum ada foto pegawai yang di-generate embedding-nya.
            </div>
          </div>
          {onNavigateToImport && (
            <button
              type="button"
              onClick={onNavigateToImport}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shrink-0"
            >
              Import Database
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Live Camera Stream + Real-time Employee Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Video feed column */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
          <div className="relative aspect-4/3 w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-md flex items-center justify-center">
            {/* Live Video Element */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''} ${
                !isCameraActive ? 'hidden' : ''
              }`}
            />

            {/* Face Recognition Canvas Overlay */}
            {isCameraActive && (
              <FaceOverlay
                faces={detectedFaces}
                videoRef={videoRef}
                isMirrored={isMirrored}
              />
            )}

            {/* Standby screen when camera is OFF */}
            {!isCameraActive && (
              <div className="text-center p-8 max-w-md">
                <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-4">
                  <Camera className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Kamera Belum Aktif</h3>
                <p className="text-xs text-slate-400 mb-5">
                  Klik tombol di bawah untuk mengaktifkan webcam dan memulai deteksi biometrik otomatis.
                </p>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  disabled={isModelLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl inline-flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  Mulai Kamera
                </button>
              </div>
            )}

            {/* Fullscreen / Kiosk Top Overlay (Date & Time) */}
            {isFullscreen && (
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
                <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white shadow-lg flex items-center gap-3">
                  <div className="text-lg font-mono font-bold text-emerald-400">
                    {currentDateTime.time}
                  </div>
                  <div className="text-xs text-slate-300 border-l border-white/20 pl-3">
                    {currentDateTime.date}
                  </div>
                </div>

                <div className="bg-slate-900/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-xs text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Wajah Terdeteksi: <strong className="text-white">{detectedFaces.length}</strong></span>
                </div>
              </div>
            )}

            {/* Bottom HUD bar on video */}
            {isCameraActive && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 bg-slate-900/75 backdrop-blur-sm rounded-xl text-white text-xs border border-white/10 pointer-events-none z-20">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-semibold">
                    {detectedFaces.length === 0
                      ? 'Mencari wajah...'
                      : `${detectedFaces.length} Wajah Terdeteksi`}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300">
                  <span>Threshold: {settings.matchThreshold}</span>
                  <span>FPS: {fps}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick instructions strip */}
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              Sistem melakukan konfirmasi temporal {settings.confirmationFrames || 3} frame berturut-turut untuk akurasi tinggi.
            </span>
            <span className="font-mono">Model: {settings.detectorType}</span>
          </div>
        </div>

        {/* Right side: Live Identification Card */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Hasil Identifikasi Real-Time
            </h3>
            {detectedFaces.length > 1 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                Multi-Wajah ({detectedFaces.length})
              </span>
            )}
          </div>

          {/* Primary face identification card */}
          <EmployeeCard
            employee={primaryFace?.employee}
            confidence={primaryFace?.confidence}
            distance={primaryFace?.distance}
            status={primaryStatus}
            consecutiveMatches={primaryFace?.consecutiveMatches}
          />

          {/* If multiple faces are detected, display secondary cards */}
          {detectedFaces.length > 1 && (
            <div className="mt-2 space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Wajah Tambahan Lainnya ({detectedFaces.length - 1}):
              </h4>
              {detectedFaces.slice(1).map((face, i) => (
                <EmployeeCard
                  key={i}
                  employee={face.employee}
                  confidence={face.confidence}
                  distance={face.distance}
                  status={face.isRecognized ? (face.isConfirmed ? 'recognized' : 'verifying') : 'unrecognized'}
                  consecutiveMatches={face.consecutiveMatches}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
