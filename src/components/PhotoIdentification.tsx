/**
 * Photo Identification Component (Identifikasi Wajah dari Foto)
 * Supports single-face and multi-face recognition from uploaded photos (JPG, JPEG, PNG, WEBP).
 * Compares against Master Server Database and Face Embeddings without re-uploading Excel/photos.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Employee, AppSettings } from '../types';
import {
  identifyFacesInImage,
  ImageFaceRecognitionResult,
  areModelsLoaded,
  loadFaceModels,
  playRecognitionChime,
} from '../services/faceRecognition';
import { recognitionLogger } from '../services/recognitionLogger';
import { EmployeeCard } from './EmployeeCard';
import {
  UploadCloud,
  FileImage,
  CheckCircle2,
  AlertTriangle,
  Users,
  RefreshCw,
  Printer,
  Sparkles,
  Info,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Eye,
  Camera,
  Layers,
  ArrowRight,
  UserX,
} from 'lucide-react';

interface PhotoIdentificationProps {
  employees: Employee[];
  settings: AppSettings;
  onNavigateToHistory?: () => void;
}

export const PhotoIdentification: React.FC<PhotoIdentificationProps> = ({
  employees,
  settings,
  onNavigateToHistory,
}) => {
  // File & image state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Recognition state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [hasIdentified, setHasIdentified] = useState<boolean>(false);
  const [recognizedFaces, setRecognizedFaces] = useState<ImageFaceRecognitionResult[]>([]);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number>(0);
  const [noFaceFound, setNoFaceFound] = useState<boolean>(false);

  // Hidden file input and canvas ref for bounding box overlay
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Active face for detail view
  const activeFace = recognizedFaces[selectedFaceIndex] || recognizedFaces[0];

  // Number of employees with ready embeddings in Master Server
  const readyEmployeesCount = employees.filter(
    (e) => e.faceDescriptor && e.faceDescriptor.length === 128
  ).length;

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Handle file selection & validation
  const processSelectedFile = (file: File) => {
    setFileError(null);
    setHasIdentified(false);
    setRecognizedFaces([]);
    setNoFaceFound(false);
    setSelectedFaceIndex(0);

    // Validate MIME type
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimeTypes.includes(file.type.toLowerCase())) {
      setFileError('Format file tidak didukung. Harap pilih file foto JPG, JPEG, PNG, atau WEBP.');
      return;
    }

    // Validate size (max 15MB)
    const maxSizeBytes = 15 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setFileError('Ukuran file terlalu besar. Maksimum ukuran file foto adalah 15MB.');
      return;
    }

    // Revoke previous URL
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setImagePreviewUrl(previewUrl);

    // Read natural dimensions
    const testImg = new Image();
    testImg.onload = () => {
      setImageDimensions({ width: testImg.naturalWidth, height: testImg.naturalHeight });
    };
    testImg.src = previewUrl;
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  // Reset to initial state
  const handleReset = () => {
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setImageDimensions(null);
    setHasIdentified(false);
    setRecognizedFaces([]);
    setSelectedFaceIndex(0);
    setNoFaceFound(false);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Draw bounding boxes on overlay canvas
  const drawBoundingBoxes = useCallback(
    (faces: ImageFaceRecognitionResult[]) => {
      const canvas = overlayCanvasRef.current;
      const img = imgElementRef.current;
      if (!canvas || !img) return;

      const displayWidth = img.clientWidth;
      const displayHeight = img.clientHeight;

      canvas.width = displayWidth;
      canvas.height = displayHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, displayWidth, displayHeight);

      const naturalW = img.naturalWidth || displayWidth;
      const naturalH = img.naturalHeight || displayHeight;
      const scaleX = displayWidth / naturalW;
      const scaleY = displayHeight / naturalH;

      faces.forEach((face, idx) => {
        const isSelected = idx === selectedFaceIndex;
        const boxX = face.box.x * scaleX;
        const boxY = face.box.y * scaleY;
        const boxW = face.box.width * scaleX;
        const boxH = face.box.height * scaleY;

        // Color based on status
        let strokeColor = '#10B981'; // emerald for recognized
        let fillColor = 'rgba(16, 185, 129, 0.12)';
        let badgeColor = '#059669';

        if (!face.isRecognized) {
          if (face.confidence > 40) {
            strokeColor = '#F59E0B'; // amber for low confidence
            fillColor = 'rgba(245, 158, 11, 0.12)';
            badgeColor = '#D97706';
          } else {
            strokeColor = '#EF4444'; // red for unknown
            fillColor = 'rgba(239, 68, 68, 0.12)';
            badgeColor = '#DC2626';
          }
        }

        // Draw box
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isSelected ? 3.5 : 2;
        ctx.fillStyle = fillColor;

        // Rounded rect for bounding box
        ctx.beginPath();
        const r = 8;
        ctx.moveTo(boxX + r, boxY);
        ctx.lineTo(boxX + boxW - r, boxY);
        ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
        ctx.lineTo(boxX + boxW, boxY + boxH - r);
        ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
        ctx.lineTo(boxX + r, boxY + boxH);
        ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
        ctx.lineTo(boxX, boxY + r);
        ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();

        // Corner highlights
        const cornerLen = Math.min(16, boxW * 0.25);
        ctx.lineWidth = 4;
        ctx.strokeStyle = isSelected ? '#FFFFFF' : strokeColor;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(boxX, boxY + cornerLen);
        ctx.lineTo(boxX, boxY);
        ctx.lineTo(boxX + cornerLen, boxY);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(boxX + boxW - cornerLen, boxY);
        ctx.lineTo(boxX + boxW, boxY);
        ctx.lineTo(boxX + boxW, boxY + cornerLen);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(boxX, boxY + boxH - cornerLen);
        ctx.lineTo(boxX, boxY + boxH);
        ctx.lineTo(boxX + cornerLen, boxY + boxH);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(boxX + boxW - cornerLen, boxY + boxH);
        ctx.lineTo(boxX + boxW, boxY + boxH);
        ctx.lineTo(boxX + boxW, boxY + boxH - cornerLen);
        ctx.stroke();

        // Number Badge [1], [2], etc.
        const badgeText = `[${idx + 1}]`;
        const labelText = face.isRecognized && face.employee
          ? `${badgeText} ${face.employee.nama.split(' ')[0]} (${face.confidence.toFixed(1).replace('.', ',')}%)`
          : `${badgeText} Tidak Dikenali`;

        ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const textW = textMetrics.width + 16;
        const textH = 22;
        const textX = boxX;
        const textY = Math.max(0, boxY - textH - 3);

        ctx.fillStyle = badgeColor;
        ctx.beginPath();
        ctx.roundRect(textX, textY, textW, textH, 4);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(labelText, textX + 8, textY + 15);
      });
    },
    [selectedFaceIndex]
  );

  // Redraw bounding boxes on resize or face selection
  useEffect(() => {
    if (hasIdentified && recognizedFaces.length > 0) {
      drawBoundingBoxes(recognizedFaces);
    }
  }, [hasIdentified, recognizedFaces, selectedFaceIndex, drawBoundingBoxes]);

  // Main Identification Trigger
  const handleIdentify = async () => {
    const img = imgElementRef.current;
    if (!img) return;

    setIsProcessing(true);
    setFileError(null);
    setNoFaceFound(false);

    try {
      if (!areModelsLoaded()) {
        await loadFaceModels();
      }

      // Execute face detection and embedding comparison against master server database
      const threshold = settings.matchThreshold || 0.5;
      const result = await identifyFacesInImage(img, employees, threshold);

      if (result.noFaceDetected || result.faces.length === 0) {
        setNoFaceFound(true);
        setRecognizedFaces([]);
        setHasIdentified(true);
        setIsProcessing(false);
        return;
      }

      setRecognizedFaces(result.faces);
      setHasIdentified(true);
      setSelectedFaceIndex(0);

      // Play audio chime if at least one face recognized and sound enabled
      const hasVerified = result.faces.some((f) => f.isRecognized);
      if (hasVerified && settings.beepOnRecognize) {
        playRecognitionChime();
      }

      // Log verified identifications into History as 'Manual Photo'
      for (const face of result.faces) {
        if (face.isRecognized && face.employee) {
          await recognitionLogger.logManualPhoto(
            face.employee,
            face.confidence,
            face.distance
          );
        }
      }
    } catch (err) {
      console.error('Photo identification failed:', err);
      setFileError(
        'Terjadi kesalahan saat memproses foto: ' +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Print report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
              📷
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              IDENTIFIKASI WAJAH DARI FOTO
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Unggah foto (JPG, JPEG, PNG, WEBP) untuk mendeteksi dan mengidentifikasi wajah pegawai menggunakan data biometrik Master Server.
          </p>
        </div>

        {/* Database Status Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Master Server: <strong>{readyEmployeesCount}</strong> Embedding Siap</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-medium">
            Threshold: <strong>{Math.round((1 - (settings.matchThreshold || 0.5) / 0.75) * 100)}%</strong>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {fileError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold">Kesalahan Berkas:</strong> {fileError}
          </div>
        </div>
      )}

      {/* Step 1: Upload / Dropzone (Shown if no photo is selected) */}
      {!imagePreviewUrl && (
        <div
          id="photo-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer bg-white shadow-xs ${
            isDragging
              ? 'border-blue-600 bg-blue-50/50 scale-[1.005]'
              : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50/70'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="max-w-md mx-auto flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100 shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-slate-800 mb-1">
              IDENTIFIKASI WAJAH DARI FOTO
            </h3>

            <div className="my-3">
              <button
                type="button"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <FileImage className="w-4 h-4" />
                PILIH FOTO
              </button>
            </div>

            <p className="text-xs text-slate-400 font-medium">
              atau Drag & Drop foto di sini
            </p>

            <div className="mt-6 pt-5 border-t border-slate-100 w-full flex items-center justify-center gap-2 text-[11px] text-slate-400 font-mono">
              <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-semibold">JPG</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-semibold">JPEG</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-semibold">PNG</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-semibold">WEBP</span>
              <span className="text-slate-300">&bull;</span>
              <span>Maksimal 15 MB</span>
            </div>

            <div className="mt-3 text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              🔒 <strong>Privasi Terjamin:</strong> Foto diproses secara lokal di browser dan tidak disimpan permanen di server.
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Photo Loaded -> Action Buttons & Analysis View */}
      {imagePreviewUrl && (
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">Berkas Foto:</span>
              <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md">
                {selectedFile?.name || 'foto-input.jpg'}
              </span>
              {imageDimensions && (
                <span className="text-[11px] text-slate-400 font-mono">
                  ({imageDimensions.width} &times; {imageDimensions.height} px)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!hasIdentified ? (
                <button
                  type="button"
                  onClick={handleIdentify}
                  disabled={isProcessing}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Memproses Identifikasi...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>IDENTIFIKASI</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>IDENTIFIKASI FOTO LAIN</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>CETAK HASIL</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleReset}
                disabled={isProcessing}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>RESET / FOTO BARU</span>
              </button>
            </div>
          </div>

          {/* Identification Progress Banner */}
          {isProcessing && (
            <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-4 text-blue-900 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h4 className="text-sm font-bold">Sedang Mengidentifikasi Wajah...</h4>
                <p className="text-xs text-blue-700 mt-0.5">
                  Mendeteksi seluruh wajah dalam foto & mencocokkan dengan {readyEmployeesCount} embedding Master Server.
                </p>
              </div>
            </div>
          )}

          {/* If No Face Detected */}
          {hasIdentified && noFaceFound && (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4 text-amber-900">
              <div className="w-12 h-12 rounded-2xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                <UserX className="w-6 h-6" />
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-black uppercase tracking-wider text-amber-900">
                  FOTO TIDAK MENGANDUNG WAJAH YANG DAPAT DIKENALI
                </h4>
                <p className="text-xs text-amber-800">
                  Sistem tidak dapat mendeteksi kontur wajah manusia pada gambar ini. Pastikan foto memiliki pencahayaan cukup, wajah menghadap lurus ke depan, dan tidak terhalang objek.
                </p>
              </div>
            </div>
          )}

          {/* Main Grid: Uploaded Image Preview & Bounding Boxes (Left) + Identity Result (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Image Canvas & Preview */}
            <div className="lg:col-span-6 xl:col-span-6 flex flex-col gap-4">
              <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between px-2 pb-2 text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    FOTO INPUT
                  </span>
                  {hasIdentified && recognizedFaces.length > 0 && (
                    <span className="text-[11px] font-mono px-2 py-0.5 bg-blue-900/60 text-blue-300 rounded-md">
                      {recognizedFaces.length} Wajah Terdeteksi
                    </span>
                  )}
                </div>

                <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  <img
                    ref={imgElementRef}
                    src={imagePreviewUrl}
                    alt="Preview Unggahan"
                    onLoad={() => {
                      if (hasIdentified && recognizedFaces.length > 0) {
                        drawBoundingBoxes(recognizedFaces);
                      }
                    }}
                    className="w-full h-auto max-h-[500px] object-contain block select-none"
                  />
                  {/* Bounding Box Overlay Canvas */}
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />
                </div>
              </div>

              {/* Multi-face Selector Pills if > 1 face */}
              {hasIdentified && recognizedFaces.length > 1 && (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" />
                      DAFTAR WAJAH TERDETEKSI ({recognizedFaces.length})
                    </span>
                    <span className="text-slate-400 font-normal">Klik untuk melihat identitas</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {recognizedFaces.map((f, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedFaceIndex(idx)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                          selectedFaceIndex === idx
                            ? 'bg-blue-50 border-blue-500 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {/* Cropped Thumbnail */}
                        <div className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                          {f.croppedFaceUrl ? (
                            <img
                              src={f.croppedFaceUrl}
                              alt={`Wajah ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-bold text-xs text-slate-400">#{idx + 1}</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-blue-900">
                              WAJAH #{idx + 1}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                f.isRecognized
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {f.isRecognized ? 'VERIFIED' : 'NOT VERIFIED'}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                            {f.isRecognized && f.employee ? f.employee.nama : 'Tidak Dikenali'}
                          </div>

                          <div className="text-[11px] text-slate-500 font-mono">
                            Kecocokan: <strong>{f.confidence.toFixed(1).replace('.', ',')}%</strong>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Identity Result Presentation */}
            <div className="lg:col-span-6 xl:col-span-6 flex flex-col gap-4">
              {!hasIdentified ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <Camera className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Foto Siap Diidentifikasi
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Tekan tombol <strong>[ IDENTIFIKASI ]</strong> di atas untuk menjalankan deteksi wajah dan mencocokkan biometrik dengan database pegawai Master Server.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleIdentify}
                      disabled={isProcessing}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      MULAI IDENTIFIKASI SEKARANG
                    </button>
                  </div>
                </div>
              ) : activeFace ? (
                <div className="space-y-4">
                  {/* Photo Comparison Section: Foto Input vs Foto Database */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-blue-600" />
                        PERBANDINGAN FOTO (INPUT VS DATABASE)
                      </h4>
                      {recognizedFaces.length > 1 && (
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          Wajah {selectedFaceIndex + 1} dari {recognizedFaces.length}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Foto Input */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col items-center text-center">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-2">
                          FOTO INPUT
                        </span>
                        <div className="w-28 h-36 rounded-xl bg-slate-200 border-2 border-slate-300 overflow-hidden flex items-center justify-center shadow-xs">
                          {activeFace.croppedFaceUrl ? (
                            <img
                              src={activeFace.croppedFaceUrl}
                              alt="Crop Wajah Input"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-slate-400">Tidak ada crop</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2 font-mono">
                          Wajah #{selectedFaceIndex + 1}
                        </span>
                      </div>

                      {/* Foto Database Pegawai */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col items-center text-center">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-2">
                          FOTO DATABASE
                        </span>
                        <div className="w-28 h-36 rounded-xl bg-slate-200 border-2 border-slate-300 overflow-hidden flex items-center justify-center shadow-xs">
                          {activeFace.isRecognized && activeFace.employee?.photoUrl ? (
                            <img
                              src={activeFace.employee.photoUrl}
                              alt={activeFace.employee.nama}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center p-2 text-slate-400">
                              <UserX className="w-8 h-8 mb-1 text-slate-300" />
                              <span className="text-[10px] font-semibold">Tidak Terdaftar</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-2 font-mono truncate max-w-[130px]">
                          {activeFace.isRecognized && activeFace.employee
                            ? activeFace.employee.nomor_induk
                            : 'Data Biometrik (-) '}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quality Diagnostic Warning if detected issues */}
                  {activeFace.qualityIssues && activeFace.qualityIssues.length > 0 && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">Foto Kurang Jelas untuk Proses Identifikasi:</div>
                        <ul className="list-disc list-inside text-[11px] text-amber-800 mt-1 space-y-0.5">
                          {activeFace.qualityIssues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Unrecognized / Not Verified Warning banner */}
                  {!activeFace.isRecognized && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-rose-900">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-600" />
                        <h4 className="text-sm font-black uppercase tracking-wider">
                          ⚠ WAJAH TIDAK DIKENALI
                        </h4>
                      </div>
                      <div className="text-xs text-rose-800 space-y-1">
                        <div>
                          Kecocokan tertinggi:{' '}
                          <strong className="font-mono">
                            {activeFace.confidence.toFixed(1).replace('.', ',')}%
                          </strong>
                          {activeFace.bestCandidate && (
                            <span className="text-[11px] text-rose-700">
                              {' '}
                              (Kemiripan terdekat dengan: {activeFace.bestCandidate.employee.nama})
                            </span>
                          )}
                        </div>
                        <div>
                          Threshold minimum:{' '}
                          <strong className="font-mono">
                            {Math.round((1 - (settings.matchThreshold || 0.5) / 0.75) * 100)}%
                          </strong>
                        </div>
                        <div className="font-bold uppercase text-[11px] pt-1 text-rose-700">
                          Status: NOT VERIFIED
                        </div>
                      </div>
                      <p className="text-[11px] text-rose-600 pt-1 border-t border-rose-200">
                        Wajah ini tidak terdaftar di database pegawai Master Server atau tingkat kemiripan berada di bawah batas toleransi keamanan.
                      </p>
                    </div>
                  )}

                  {/* Full Employee Identification Card (Identitas Lengkap dari Database & Excel) */}
                  <div className="space-y-1">
                    <EmployeeCard
                      employee={activeFace.isRecognized ? activeFace.employee : undefined}
                      confidence={activeFace.confidence}
                      distance={activeFace.distance}
                      status={activeFace.isRecognized ? 'verified' : 'unknown'}
                      faceIndex={selectedFaceIndex}
                      totalFaces={recognizedFaces.length}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
