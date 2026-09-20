/**
 * Canvas overlay to render multi-face bounding boxes, labels, and tracking indicators.
 */
import React, { useEffect, useRef } from 'react';
import { DetectedFaceResult } from '../types';

interface FaceOverlayProps {
  faces: DetectedFaceResult[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isMirrored?: boolean;
}

export const FaceOverlay: React.FC<FaceOverlayProps> = ({
  faces,
  videoRef,
  isMirrored = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas pixel buffer to video source resolution
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;

    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (faces.length === 0) return;

    // Draw each detected face
    faces.forEach((face) => {
      const { box, isRecognized, employee, confidence = 0, isConfirmed, consecutiveMatches = 0 } = face;

      let x = box.x;
      const y = box.y;
      const w = box.width;
      const h = box.height;

      // Handle horizontal mirroring if video is flipped
      if (isMirrored) {
        x = canvas.width - x - w;
      }

      // Determine colors and label
      let strokeColor = '#ef4444'; // Red for unknown
      let bgColor = 'rgba(239, 68, 68, 0.9)';
      let label = 'Wajah Belum Dikenali';

      if (isRecognized && employee) {
        if (isConfirmed) {
          strokeColor = '#10b981'; // Green for verified
          bgColor = 'rgba(16, 185, 129, 0.92)';
          label = `${employee.nama} (${confidence}%)`;
        } else {
          strokeColor = '#f59e0b'; // Amber for verifying
          bgColor = 'rgba(245, 158, 11, 0.92)';
          label = `Memverifikasi (${consecutiveMatches}/3)...`;
        }
      }

      // 1. Draw corner brackets around face (modern tech/enterprise style)
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = bgColor;

      const cornerLength = Math.min(26, w / 4);

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLength);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLength, y);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLength, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLength);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(x, y + h - cornerLength);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + cornerLength, y + h);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLength, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - cornerLength);
      ctx.stroke();

      // Subtle full perimeter bounding box with lower opacity
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = strokeColor + '55'; // 33% alpha
      ctx.strokeRect(x, y, w, h);

      // 2. Draw label tag above or below face
      ctx.font = '600 13px Plus Jakarta Sans, sans-serif';
      const textMetrics = ctx.measureText(label);
      const tagWidth = textMetrics.width + 20;
      const tagHeight = 24;

      let tagY = y - tagHeight - 6;
      if (tagY < 10) {
        tagY = y + h + 8; // Place below if top has no room
      }
      const tagX = Math.max(10, Math.min(canvas.width - tagWidth - 10, x + (w - tagWidth) / 2));

      // Tag pill background
      ctx.fillStyle = bgColor;
      roundRect(ctx, tagX, tagY, tagWidth, tagHeight, 5);
      ctx.fill();

      // Tag text
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(label, tagX + 10, tagY + tagHeight / 2 + 1);
    });
  }, [faces, videoRef, isMirrored]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    />
  );
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
