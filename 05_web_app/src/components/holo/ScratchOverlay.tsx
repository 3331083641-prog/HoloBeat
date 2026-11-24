import React, { useEffect, useRef } from 'react';
import { holoAudio } from '../../audio/HoloAudioEngine';

interface ScratchOverlayProps {
  width: number;
  height: number;
  onReveal: () => void;
}

export const ScratchOverlay: React.FC<ScratchOverlayProps> = ({ width, height, onReveal }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const lastCheckRef = useRef(0);
  const revealedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    revealedRef.current = false;

    // 100% Offline Procedural Holographic Silver Scratch Coating
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#CBD5E1');
    grad.addColorStop(0.25, '#F8FAFC');
    grad.addColorStop(0.45, '#94A3B8');
    grad.addColorStop(0.68, '#E2E8F0');
    grad.addColorStop(0.85, '#CBD5E1');
    grad.addColorStop(1, '#64748B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle holographic rainbow sheen lines over silver coating
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (let x = -height; x < width + height; x += 26) {
      ctx.strokeStyle = x % 52 === 0 ? '#38BDF8' : '#FF3D9A';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();
    }
    ctx.restore();

    // Diagonal repeating watermark text
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-0.35);
    ctx.font = '900 13px "Space Grotesk", sans-serif';
    ctx.fillStyle = 'rgba(26, 26, 31, 0.22)';
    ctx.textAlign = 'center';
    for (let y = -height; y < height; y += 36) {
      ctx.fillText('✦ SCRATCH TO UNBOX ✦ 刮开涂层 ✦', 0, y);
    }
    ctx.restore();

    // Center bold cue badge
    ctx.save();
    const boxW = width * 0.78;
    const boxH = 66;
    const bx = (width - boxW) / 2;
    const by = (height - boxH) / 2;
    ctx.fillStyle = '#181820';
    ctx.strokeStyle = '#FFD60A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFD60A';
    ctx.font = '900 15px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH TO UNBOX', width / 2, by + 29);
    ctx.fillStyle = '#FFFDF8';
    ctx.font = '700 12px "HarmonyOS Sans SC", "PingFang SC", sans-serif';
    ctx.fillText('按住滑动刮开全息涂层', width / 2, by + 50);
    ctx.restore();
  }, [width, height]);

  const checkProgress = () => {
    if (revealedRef.current) return;
    const now = performance.now();
    if (now - lastCheckRef.current < 120) return;
    lastCheckRef.current = now;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let cleared = 0;
    let sampled = 0;
    // Stride-32 pixel sampling (< 0.3ms)
    for (let i = 3; i < data.length; i += 4 * 32) {
      sampled++;
      if (data[i] < 40) cleared++;
    }
    if (sampled > 0 && cleared / sampled >= 0.42) {
      revealedRef.current = true;
      onReveal();
    }
  };

  const eraseAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 44;

    ctx.beginPath();
    if (lastPtRef.current) {
      ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    lastPtRef.current = { x, y };
    void holoAudio.playSfx('scratch', 0.65);
    checkProgress();
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        drawingRef.current = true;
        lastPtRef.current = null;
        eraseAt(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!drawingRef.current) return;
        e.stopPropagation();
        eraseAt(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        drawingRef.current = false;
        lastPtRef.current = null;
        checkProgress();
      }}
      onPointerCancel={() => {
        drawingRef.current = false;
        lastPtRef.current = null;
      }}
      className="absolute inset-0 w-full h-full z-30 rounded-[13px] cursor-crosshair touch-none"
    />
  );
};
