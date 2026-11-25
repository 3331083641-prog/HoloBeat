import { holoAudio } from '../audio/HoloAudioEngine';
import { renderCompositionSnapshotCached } from '../audio/wavExporter';
import { getStandaloneArtworkSvg } from '../components/artwork/CardArtwork';
import { HOLO_FOIL_LIST, RARITY_META } from '../data/soundCards';
import { getStickerById } from '../data/stickers';
import { TRACK_MOTION_PROFILES, drawTrackMotifShape } from '../motion/holoMotion';
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
  signal?: AbortSignal;
  onProgress?: (pct: number) => void;
}

export interface MotionCardExportResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  hasAudioTrack: boolean;
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

const ZH_SANS = '"Noto Sans SC", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
const HW_MONO = '"JetBrains Mono", "Noto Sans SC", "PingFang SC", monospace';

/**
 * Browser-native Animated Holographic Motion Card Recorder (.webm).
 * - Uses true work length + acoustic tail from the canonical rendered WAV artifact (NO 7000ms hard cut!)
 * - Plays the EXACT canonical WAV audio into MediaStreamDestination for bit-accurate audio parity
 * - Supports AbortSignal cancellation and cleans up streams, RAF, recorder & playback reliably!
 */
export async function recordMotionCardWebm(
  opts: MotionCardExportOptions
): Promise<MotionCardExportResult> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('当前浏览器不支持动态视频录制（缺少 MediaRecorder）');
  }
  if (opts.signal?.aborted) {
    throw new Error('已取消动态闪卡导出');
  }
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue with fallback font
    }
  }

  // Always obtain the canonical rendered WAV artifact first (reuses IndexedDB cache!)
  const artifact = await renderCompositionSnapshotCached(opts.snapshot);
  if (opts.signal?.aborted) {
    throw new Error('已取消动态闪卡导出');
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
  if (!ctx) throw new Error('Canvas 2D 上下文不可用');

  const artImg = await loadSvgImg(getStandaloneArtworkSvg(opts.artId));
  const sortedStickers = [...opts.stickers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const stickerImgs = await Promise.all(
    sortedStickers.map(async (stk) => {
      const def = getStickerById(stk.stickerId);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="160" height="160">${def.svgInner}</svg>`;
      return { stk, img: await loadSvgImg(svg) };
    })
  );

  const audioStream = await holoAudio.getAudioCaptureStream();
  const canvasStream = canvas.captureStream(30);
  const combined = new MediaStream();
  canvasStream.getVideoTracks().forEach((t) => combined.addTrack(t));
  const hasAudioTrack = Boolean(audioStream && audioStream.getAudioTracks().length > 0);
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

  // Exact true work length + acoustic tail (NEVER hard-capped at 7000ms!)
  const durationMs = Math.max(1800, Math.round(artifact.durationSec * 1000) + 120);
  const foilMeta = HOLO_FOIL_LIST.find((f) => f.id === opts.foil) ?? HOLO_FOIL_LIST[0];
  const rar = RARITY_META[opts.rarity];
  const barColors = ['#7C3AED', '#FF3D9A', '#FF5C2B', '#FFD60A', '#00D4AA', '#38BDF8'];
  const hitBursts: { x: number; y: number; color: string; age: number; cat: TrackCategory }[] = [];

  return new Promise<MotionCardExportResult>((resolve, reject) => {
    let rafId = 0;
    let settled = false;

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      holoAudio.stopSnapshotPlayback();
      canvasStream.getVideoTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      opts.signal?.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // ignore
      }
      cleanup();
      reject(new Error('已取消动态闪卡导出'));
    };

    opts.signal?.addEventListener('abort', onAbort);

    recorder.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('视频编码器录制失败'));
    };

    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      if (blob.size < 256) {
        reject(new Error('动态闪卡编码产物为空，请重试'));
        return;
      }
      resolve({
        blob,
        mimeType: mimeType || 'video/webm',
        durationMs,
        hasAudioTrack,
      });
    };

    recorder.start(100);
    const startTs = performance.now();

    void holoAudio.playAudioBlob(artifact.wavBlob, {
      leadInMs: 40,
      events: opts.snapshot.events,
      onEvent: (ev) => {
        const bx = 95 + (ev.timeOffsetMs / Math.max(1000, opts.snapshot.durationMs)) * (W - 190);
        const by = 590 - ev.trackIndex * 16;
        hitBursts.push({ x: bx, y: by, color: ev.color, age: 0, cat: ev.trackCategory });
      },
    });

    const renderFrame = (now: number) => {
      if (settled) return;
      const elapsed = now - startTs;
      const prog = Math.min(1, elapsed / durationMs);
      opts.onProgress?.(Math.round(prog * 100));

      ctx.fillStyle = '#14151B';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let gx = 30; gx < W; gx += 30) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      for (let gy = 30; gy < H; gy += 30) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }

      const swayX = Math.sin(elapsed * 0.0026) * 12;
      const swayY = Math.cos(elapsed * 0.0019) * 5;
      const cardW = 460;
      const cardH = 644;
      const cx = (W - cardW) / 2 + swayX * 0.35;
      const cy = 68 + swayY * 0.4;

      const meter = holoAudio.getMeterLevel();
      const aura = ctx.createRadialGradient(
        W / 2,
        cy + cardH / 2,
        40,
        W / 2,
        cy + cardH / 2,
        290 + meter * 48
      );
      aura.addColorStop(0, opts.rarity === 'LTD' ? 'rgba(255,214,10,0.4)' : 'rgba(124,58,237,0.4)');
      aura.addColorStop(0.55, 'rgba(0,212,170,0.2)');
      aura.addColorStop(1, 'rgba(20,21,27,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.roundRect(0, 0, cardW, cardH, 28);
      ctx.clip();

      const shift = Math.sin(elapsed * 0.0024) * 160;
      const frameGrad = ctx.createLinearGradient(-shift, 0, cardW - shift, cardH);
      if (opts.rarity === 'LTD' || opts.foil === 'gold') {
        frameGrad.addColorStop(0, '#1A1A1F');
        frameGrad.addColorStop(0.42, '#FEF08A');
        frameGrad.addColorStop(0.7, '#D97706');
        frameGrad.addColorStop(1, '#1A1A1F');
      } else {
        frameGrad.addColorStop(0, '#7C3AED');
        frameGrad.addColorStop(0.35, '#FFD60A');
        frameGrad.addColorStop(0.68, '#00D4AA');
        frameGrad.addColorStop(1, '#FF5C2B');
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

      // Controlled foil diffraction ONLY over artwork region (keeps nameplate, badges & waveform crisp!)
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad, pad, iw, artH);
      ctx.clip();
      ctx.globalCompositeOperation = 'color-dodge';
      ctx.globalAlpha = 0.34;
      const beamX = ((elapsed * 0.22) % (cardW * 2)) - cardW * 0.5;
      const beam = ctx.createLinearGradient(beamX, 0, beamX + 240, artH);
      beam.addColorStop(0, '#000000');
      beam.addColorStop(0.28, '#7C3AED');
      beam.addColorStop(0.5, '#FFD60A');
      beam.addColorStop(0.72, '#00D4AA');
      beam.addColorStop(1, '#000000');
      ctx.fillStyle = beam;
      ctx.fillRect(pad, pad, iw, artH);
      ctx.restore();

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

      // Embedded real PCM waveform strip (rendered ABOVE foil layer!)
      const fpX = pad + 20;
      const fpY = pad + artH - 54;
      const fpW = iw - 40;
      const fpH = 42;
      ctx.fillStyle = 'rgba(20, 21, 27, 0.95)';
      ctx.beginPath();
      ctx.roundRect(fpX, fpY, fpW, fpH, 21);
      ctx.fill();

      const bars =
        artifact.waveformBars.length > 0
          ? artifact.waveformBars
          : opts.waveformBars.length > 0
            ? opts.waveformBars
            : Array<number>(24).fill(0.4);
      const bGap = 4;
      const bW = (fpW - 28 - bGap * (bars.length - 1)) / bars.length;
      const musicProg = Math.min(1, elapsed / Math.max(800, artifact.musicDurationSec * 1000));
      bars.forEach((v, i) => {
        const passed = i / bars.length <= musicProg;
        const boost = passed ? 0.88 + meter * 0.3 : 0.45;
        const bh = Math.max(6, Math.min(1, v * boost) * (fpH - 12));
        ctx.fillStyle = barColors[Math.floor((i / bars.length) * barColors.length)];
        ctx.globalAlpha = passed ? 1 : 0.38;
        ctx.beginPath();
        ctx.roundRect(fpX + 14 + i * (bW + bGap), fpY + (fpH - bh) / 2, bW, bh, 3);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Rarity & Code Badges (Protected crisp ink)
      ctx.fillStyle = rar.bg;
      ctx.strokeStyle = '#1A1A1F';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(pad + 14, pad + 14, 82, 34, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rar.text;
      ctx.font = '800 18px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.rarity, pad + 55, pad + 32);

      ctx.fillStyle = '#FFFDF8';
      ctx.beginPath();
      ctx.roundRect(pad + iw - 102, pad + 14, 88, 30, 15);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1A1A1F';
      ctx.font = '700 14px "JetBrains Mono", monospace';
      ctx.fillText(opts.code, pad + iw - 58, pad + 30);

      // Nameplate (Protected crisp text)
      const isLtd = opts.rarity === 'LTD';
      ctx.fillStyle = isLtd ? '#14151B' : '#FFFDF8';
      ctx.fillRect(pad, pad + artH, iw, ribH);
      ctx.strokeStyle = '#1A1A1F';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pad, pad + artH);
      ctx.lineTo(pad + iw, pad + artH);
      ctx.stroke();

      ctx.fillStyle = isLtd ? '#FEF08A' : '#1A1A1F';
      ctx.font = `900 28px ${ZH_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`✦ ${opts.title} ✦`, cardW / 2, pad + artH + ribH / 2 + 4, iw - 40);

      ctx.restore(); // inner clip
      ctx.restore(); // card transform

      // Live shape-coded Sound-Life Bursts Below Card
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

      // 4 Shape-Coded Voice Motifs Footer
      const cats: TrackCategory[] = ['BEAT', 'PERC', 'MELODY', 'VIBE'];
      cats.forEach((cat, i) => {
        const p = TRACK_MOTION_PROFILES[cat];
        const ox = 165 + i * 90;
        const oy = 766 - Math.abs(Math.sin(elapsed * 0.005 + i * 1.1)) * (10 + meter * 20);
        ctx.save();
        ctx.translate(ox, oy);
        drawTrackMotifShape(ctx, p.shape, 7.5, p.color, '#FFFDF8', meter);
        ctx.restore();
      });

      ctx.fillStyle = 'rgba(255, 253, 248, 0.8)';
      ctx.font = `700 13px ${HW_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(
        `HOLOBEAT 动态闪卡 · ${opts.code} · ${foilMeta.zhLabel} · ${opts.snapshot.bpm} BPM · ${(artifact.durationSec).toFixed(1)}s`,
        W / 2,
        812
      );

      if (elapsed < durationMs) {
        rafId = requestAnimationFrame(renderFrame);
      } else {
        if (recorder.state !== 'inactive') recorder.stop();
      }
    };

    rafId = requestAnimationFrame(renderFrame);
  });
}
