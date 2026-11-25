import { holoAudio } from '../audio/HoloAudioEngine';
import { getStandaloneArtworkSvg } from '../components/artwork/CardArtwork';
import { HOLO_FOIL_LIST, RARITY_META } from '../data/soundCards';
import { getStickerById } from '../data/stickers';
import { TRACK_MOTION_PROFILES } from '../motion/holoMotion';
import type {
  CompositionSnapshot,
  ForgeRarity,
  HoloFoilType,
  PlacedSticker,
  TrackCategory,
} from '../types/holo';

export interface MotionCardExportOptions {
  title: string;
  code: string;
  rarity: ForgeRarity;
  foil: HoloFoilType;
  artId: string;
  stickers: PlacedSticker[];
  waveformBars: number[];
  snapshot: CompositionSnapshot;
  onProgress?: (pct: number) => void;
}

function loadSvgImg(svgMarkup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Genuine browser-native Animated Holographic Motion Card Recorder (.webm).
 * Combines live Canvas 2D holographic foil animation + real audio-event bouncing rhythm orbs
 * + synchronized real Tone.js audio captured via MediaStreamDestination into MediaRecorder!
 */
export async function recordMotionCardWebm(opts: MotionCardExportOptions): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('当前浏览器不支持 MediaRecorder 视频录制');
  }

  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

  const W = 600;
  const H = 840;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  const artImg = await loadSvgImg(getStandaloneArtworkSvg(opts.artId));
  const stickerImgs = await Promise.all(
    opts.stickers.map(async (stk) => {
      const def = getStickerById(stk.stickerId);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="160" height="160">${def.svgInner}</svg>`;
      return { stk, img: await loadSvgImg(svg) };
    })
  );

  const audioStream = await holoAudio.getAudioCaptureStream();
  const canvasStream = canvas.captureStream(30);
  const combined = new MediaStream();
  canvasStream.getVideoTracks().forEach((t) => combined.addTrack(t));
  if (audioStream) {
    audioStream.getAudioTracks().forEach((t) => combined.addTrack(t));
  }

  const recorder = new MediaRecorder(
    combined,
    mimeType ? { mimeType, videoBitsPerSecond: 3_600_000 } : undefined
  );
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const durationMs = Math.min(7000, Math.max(2800, opts.snapshot.durationMs + 400));
  const foilMeta = HOLO_FOIL_LIST.find((f) => f.id === opts.foil) ?? HOLO_FOIL_LIST[0];
  const rar = RARITY_META[opts.rarity];
  const barColors = ['#7C3AED', '#FF3D9A', '#FF5526', '#FFD426', '#00D4AA', '#38BDF8'];
  const hitBursts: { x: number; y: number; color: string; age: number }[] = [];

  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('视频编码器录制失败'));
    recorder.onstop = () => {
      holoAudio.stopSnapshotPlayback();
      resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
    };

    recorder.start(100);
    const startTs = performance.now();

    void holoAudio.playCompositionSnapshot(opts.snapshot, {
      leadInMs: 80,
      onEvent: (ev) => {
        const bx = 95 + ((ev.timeOffsetMs / Math.max(1000, opts.snapshot.durationMs)) * (W - 190));
        const by = 590 - ev.trackIndex * 16;
        hitBursts.push({ x: bx, y: by, color: ev.color, age: 0 });
      },
    });

    const renderFrame = (now: number) => {
      const elapsed = now - startTs;
      const prog = Math.min(1, elapsed / durationMs);
      opts.onProgress?.(Math.round(prog * 100));

      // Obsidian Gallery Backdrop
      ctx.fillStyle = '#121319';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let gx = 30; gx < W; gx += 30) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 30; gy < H; gy += 30) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      // Gentle rhythmic hover sway driven by elapsed time
      const swayX = Math.sin(elapsed * 0.0028) * 14;
      const swayY = Math.cos(elapsed * 0.0021) * 6;
      const cardW = 460;
      const cardH = 644;
      const cx = (W - cardW) / 2 + swayX * 0.35;
      const cy = 76 + swayY * 0.4;

      // Ambient Spotlight Aura
      const meter = holoAudio.getMeterLevel();
      const aura = ctx.createRadialGradient(W / 2, cy + cardH / 2, 40, W / 2, cy + cardH / 2, 300 + meter * 50);
      aura.addColorStop(0, opts.rarity === 'LTD' ? 'rgba(255,214,10,0.42)' : 'rgba(124,58,237,0.42)');
      aura.addColorStop(0.55, 'rgba(255,61,154,0.22)');
      aura.addColorStop(1, 'rgba(18,19,25,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, W, H);

      // Card Container
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.roundRect(0, 0, cardW, cardH, 28);
      ctx.clip();

      const shift = Math.sin(elapsed * 0.0025) * 160;
      const frameGrad = ctx.createLinearGradient(-shift, 0, cardW - shift, cardH);
      if (opts.rarity === 'LTD' || opts.foil === 'gold') {
        frameGrad.addColorStop(0, '#17171C');
        frameGrad.addColorStop(0.42, '#FEF08A');
        frameGrad.addColorStop(0.7, '#D97706');
        frameGrad.addColorStop(1, '#17171C');
      } else {
        frameGrad.addColorStop(0, '#FF3D9A');
        frameGrad.addColorStop(0.3, '#FFD426');
        frameGrad.addColorStop(0.6, '#00D4AA');
        frameGrad.addColorStop(1, '#7C3AED');
      }
      ctx.fillStyle = frameGrad;
      ctx.fillRect(0, 0, cardW, cardH);

      const pad = 16;
      const iw = cardW - pad * 2;
      const ih = cardH - pad * 2;
      const ribH = 88;
      const artH = ih - ribH;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(pad, pad, iw, ih, 20);
      ctx.clip();

      ctx.drawImage(artImg, pad, pad, iw, artH);

      stickerImgs.forEach(({ stk, img }) => {
        const sx = pad + (stk.x / 100) * iw;
        const sy = pad + (stk.y / 100) * artH;
        const sz = 76 * stk.scale;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate((stk.rotation * Math.PI) / 180);
        ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      });

      // Live Animated Audio Waveform Strip + Progress Playhead!
      const fpX = pad + 20;
      const fpY = pad + artH - 54;
      const fpW = iw - 40;
      const fpH = 42;
      ctx.fillStyle = 'rgba(20, 21, 27, 0.94)';
      ctx.beginPath();
      ctx.roundRect(fpX, fpY, fpW, fpH, 21);
      ctx.fill();

      const bars = opts.waveformBars.length > 0 ? opts.waveformBars : Array<number>(24).fill(0.4);
      const bGap = 4;
      const bW = (fpW - 28 - bGap * (bars.length - 1)) / bars.length;
      bars.forEach((v, i) => {
        const passed = i / bars.length <= prog;
        const boost = passed ? 0.85 + meter * 0.35 : 0.45;
        const bh = Math.max(6, Math.min(1, v * boost) * (fpH - 12));
        ctx.fillStyle = barColors[Math.floor((i / bars.length) * barColors.length)];
        ctx.globalAlpha = passed ? 1 : 0.4;
        ctx.beginPath();
        ctx.roundRect(fpX + 14 + i * (bW + bGap), fpY + (fpH - bh) / 2, bW, bh, 3);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Rarity & Code Badges
      ctx.fillStyle = rar.bg;
      ctx.strokeStyle = '#17171C';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(pad + 14, pad + 14, 82, 34, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rar.text;
      ctx.font = '900 18px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.rarity, pad + 55, pad + 32);

      ctx.fillStyle = '#FBF9F4';
      ctx.beginPath();
      ctx.roundRect(pad + iw - 102, pad + 14, 88, 30, 15);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#17171C';
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.fillText(opts.code, pad + iw - 58, pad + 30);

      // Nameplate
      const isLtd = opts.rarity === 'LTD';
      ctx.fillStyle = isLtd ? '#14151B' : '#FBF9F4';
      ctx.fillRect(pad, pad + artH, iw, ribH);
      ctx.strokeStyle = '#17171C';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pad, pad + artH);
      ctx.lineTo(pad + iw, pad + artH);
      ctx.stroke();

      ctx.fillStyle = isLtd ? '#FEF08A' : '#17171C';
      ctx.font = 'italic 900 30px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`✦ ${opts.title.toUpperCase()} ✦`, cardW / 2, pad + artH + ribH / 2 + 6);

      // Animated Sweeping Black-Valley Holographic Diffraction Beam!
      ctx.save();
      ctx.globalCompositeOperation = 'color-dodge';
      ctx.globalAlpha = 0.45;
      const beamX = ((elapsed * 0.24) % (cardW * 2)) - cardW * 0.5;
      const beam = ctx.createLinearGradient(beamX, 0, beamX + 260, cardH);
      beam.addColorStop(0, '#000000');
      beam.addColorStop(0.25, '#FF3D9A');
      beam.addColorStop(0.45, '#FFD426');
      beam.addColorStop(0.65, '#00D4AA');
      beam.addColorStop(0.85, '#38BDF8');
      beam.addColorStop(1, '#000000');
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, cardW, cardH);
      ctx.restore();

      ctx.restore(); // inner clip
      ctx.restore(); // card transform

      // Live Bouncing Sound-Life Bursts Below Card!
      for (let i = hitBursts.length - 1; i >= 0; i--) {
        const b = hitBursts[i];
        b.age += 0.045;
        if (b.age >= 1) {
          hitBursts.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = 1 - b.age;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y + 150, 8 + b.age * 36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Bottom Footer Metadata
      const cats: TrackCategory[] = ['BEAT', 'PERC', 'MELODY', 'VIBE'];
      cats.forEach((cat, i) => {
        const p = TRACK_MOTION_PROFILES[cat];
        const ox = 160 + i * 94;
        const oy = 774 - Math.abs(Math.sin(elapsed * 0.005 + i * 1.1)) * (12 + meter * 22);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(ox, oy, 7, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = 'rgba(251, 249, 244, 0.72)';
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `HOLOBEAT MOTION CARD · ${opts.code} · ${foilMeta.label} · ${opts.snapshot.bpm} BPM`,
        W / 2,
        812
      );

      if (elapsed < durationMs) {
        requestAnimationFrame(renderFrame);
      } else {
        if (recorder.state !== 'inactive') recorder.stop();
      }
    };

    requestAnimationFrame(renderFrame);
  });
}
