import React, { useEffect, useRef, useState } from 'react';
import { holoAudio } from '../../audio/HoloAudioEngine';

interface ScratchOverlayProps {
  width: number;
  height: number;
  onReveal: () => void;
}

interface FoilFlake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  life: number;
  color: string;
}

export const ScratchOverlay: React.FC<ScratchOverlayProps> = ({ width, height, onReveal }) => {
  const foilCanvasRef = useRef<HTMLCanvasElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const lastCheckRef = useRef(0);
  const revealedRef = useRef(false);
  const flakesRef = useRef<FoilFlake[]>([]);
  const [progressPct, setProgressPct] = useState(0);

  // Initialize Brushed Holographic Silver Foil Coating
  useEffect(() => {
    const canvas = foilCanvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    revealedRef.current = false;
    setProgressPct(0);

    // Base brushed metallic silver foil
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#CBD5E1');
    grad.addColorStop(0.22, '#F8FAFC');
    grad.addColorStop(0.45, '#94A3B8');
    grad.addColorStop(0.68, '#E2E8F0');
    grad.addColorStop(0.86, '#CBD5E1');
    grad.addColorStop(1, '#64748B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Fine brushed metal horizontal micro-hairlines
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    for (let y = 2; y < height; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    // Iridescent holographic security stripes
    ctx.save();
    ctx.globalAlpha = 0.26;
    const stripeColors = ['#38BDF8', '#FF3D9A', '#FFD426', '#00D4AA'];
    let idx = 0;
    for (let x = -height; x < width + height; x += 28) {
      ctx.strokeStyle = stripeColors[idx % stripeColors.length];
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();
      idx++;
    }
    ctx.restore();

    // Repeating diagonal micro-watermark
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-0.34);
    ctx.font = '900 12px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(23, 23, 28, 0.22)';
    ctx.textAlign = 'center';
    for (let y = -height; y < height; y += 34) {
      ctx.fillText('✦ SCRATCH FOIL ✦ 刮开盲盒涂层 ✦', 0, y);
    }
    ctx.restore();

    // Crisp center industrial unbox seal
    ctx.save();
    const boxW = width * 0.8;
    const boxH = 74;
    const bx = (width - boxW) / 2;
    const by = (height - boxH) / 2;
    ctx.fillStyle = '#14151B';
    ctx.strokeStyle = '#FFD426';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFD426';
    ctx.font = '900 14px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦ SCRATCH TO UNBOX ✦', width / 2, by + 29);
    ctx.fillStyle = '#FBF9F4';
    ctx.font = '700 12px "HarmonyOS Sans SC", "PingFang SC", sans-serif';
    ctx.fillText('按住滑动刮开全息银膜', width / 2, by + 52);
    ctx.restore();
  }, [width, height]);

  // Foil Scrap Particle Physics Loop (Runs lightly while particles exist)
  useEffect(() => {
    const fx = fxCanvasRef.current;
    if (!fx) return;
    fx.width = width;
    fx.height = height;
    const ctx = fx.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const render = () => {
      const list = flakesRef.current;
      ctx.clearRect(0, 0, width, height);
      for (let i = list.length - 1; i >= 0; i--) {
        const f = list[i];
        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.22; // gentle gravity
        f.rot += f.vrot;
        f.life -= 0.035;
        if (f.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.fillStyle = f.color;
        ctx.fillRect(-f.size / 2, -f.size / 3, f.size, f.size * 0.65);
        ctx.restore();
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  const spawnFoilFlakes = (x: number, y: number) => {
    const colors = ['#F8FAFC', '#CBD5E1', '#FFD426', '#38BDF8', '#FF3D9A'];
    for (let i = 0; i < 4; i++) {
      if (flakesRef.current.length > 70) break;
      flakesRef.current.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 4.2,
        vy: -Math.random() * 2.8 - 0.5,
        size: 3 + Math.random() * 4.5,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.25,
        life: 0.9 + Math.random() * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  };

  const checkProgress = () => {
    if (revealedRef.current) return;
    const now = performance.now();
    if (now - lastCheckRef.current < 95) return;
    lastCheckRef.current = now;

    const canvas = foilCanvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let cleared = 0;
    let sampled = 0;
    for (let i = 3; i < data.length; i += 4 * 32) {
      sampled++;
      if (data[i] < 40) cleared++;
    }
    const ratio = sampled > 0 ? cleared / sampled : 0;
    setProgressPct(Math.min(100, Math.round((ratio / 0.38) * 100)));
    if (ratio >= 0.38) {
      revealedRef.current = true;
      onReveal();
    }
  };

  const eraseAt = (clientX: number, clientY: number) => {
    const canvas = foilCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 48;

    ctx.beginPath();
    if (lastPtRef.current) {
      ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    lastPtRef.current = { x, y };
    spawnFoilFlakes(x, y);
    void holoAudio.playSfx('scratch', 0.65);
    checkProgress();
  };

  return (
    <div className="absolute inset-0 z-30 rounded-[11px] overflow-hidden">
      <canvas
        ref={foilCanvasRef}
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
        className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
      />
      {/* Sparkling Foil Debris Particle Overlay */}
      <canvas
        ref={fxCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      {/* Live Scratch Progress Indicator Pill */}
      {progressPct > 0 && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 pointer-events-none px-2.5 py-0.5 rounded-full bg-[#14151B]/90 border border-[#FFD426] font-mono-hw text-[10px] font-bold text-[#FFD426] shadow-md">
          UNBOXING {progressPct}%
        </div>
      )}
    </div>
  );
};
