import { renderCompositionSnapshotCached } from '../audio/wavExporter';
import { loadCompositeCardArtworkCanvas } from '../components/artwork/CardArtwork';
import { HOLO_FOIL_LIST, RARITY_META } from '../data/soundCards';
import { loadStickerImage } from '../data/stickers';
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

const ZH_SANS = '"Noto Sans SC", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
const HW_MONO = '"JetBrains Mono", "Noto Sans SC", "PingFang SC", monospace';

/** Record one frozen work and its acoustic tail using the redesigned card artwork. */
export async function recordMotionCardWebm(opts: MotionCardExportOptions): Promise<MotionCardExportResult> {
  if (typeof MediaRecorder === 'undefined') throw new Error('当前浏览器不支持动态视频录制');
  if (opts.signal?.aborted || document.hidden) throw new Error('动态卡录制已取消');

  let cancel!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    cancel = () => reject(new Error('动态卡录制已取消'));
  });
  const hidden = () => { if (document.hidden) cancel(); };
  opts.signal?.addEventListener('abort', cancel, { once: true });
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener('pagehide', cancel);
  try {
    return await captureMotion(opts, aborted);
  } finally {
    opts.signal?.removeEventListener('abort', cancel);
    document.removeEventListener('visibilitychange', hidden);
    window.removeEventListener('pagehide', cancel);
  }
}

async function captureMotion(opts: MotionCardExportOptions, aborted: Promise<never>): Promise<MotionCardExportResult> {
  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

  if (!mimeType) throw new Error('浏览器没有可用的 WebM 音视频编码器');
  const W = 600;
  const H = 840;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 上下文不可用');

  const audio = new AudioContext();
  const tracks = new Set<MediaStreamTrack>();
  let recorder: MediaRecorder | undefined;
  let source: AudioBufferSourceNode | undefined;
  let destination: MediaStreamAudioDestinationNode | undefined;
  let analyser: AnalyserNode | undefined;
  let sourceStarted = false;
  let frame = 0;
  let watchdog = 0;
  try {
    await Promise.race([audio.resume(), aborted]);
    if (document.fonts?.ready) await Promise.race([document.fonts.ready, aborted]);
    const artifact = await Promise.race([renderCompositionSnapshotCached(opts.snapshot), aborted]);
    const artImg = await Promise.race([loadCompositeCardArtworkCanvas(opts.artId), aborted]);
    const sortedStickers = [...opts.stickers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const stickerImgs = await Promise.race([Promise.all(sortedStickers.map(async stk => ({
      stk, img: await loadStickerImage(stk.stickerId),
    }))), aborted]);
    const bytes = await Promise.race([artifact.wavBlob.arrayBuffer(), aborted]);
    const buffer = await Promise.race([audio.decodeAudioData(bytes), aborted]);
    source = audio.createBufferSource();
    source.buffer = buffer;
    destination = audio.createMediaStreamDestination();
    const meterNode = audio.createAnalyser();
    analyser = meterNode;
    meterNode.fftSize = 256;
    const meterData = new Float32Array(meterNode.fftSize);
    source.connect(meterNode);
    meterNode.connect(destination);
    destination.stream.getTracks().forEach(track => tracks.add(track));
    canvas.captureStream(30).getTracks().forEach(track => tracks.add(track));
    const stream = new MediaStream([...tracks]);
    if (!stream.getAudioTracks().some(track => track.readyState === 'live' && track.enabled) ||
        !stream.getVideoTracks().some(track => track.readyState === 'live' && track.enabled)) {
      throw new Error('浏览器未能创建有效的音频或视频轨');
    }
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3600000 });
    const activeRecorder = recorder;
    const activeSource = source;
    const durationMs = buffer.duration * 1000;
    const chunks: BlobPart[] = [];
    const foilMeta = HOLO_FOIL_LIST.find((f) => f.id === opts.foil) ?? HOLO_FOIL_LIST[0];
    const rar = RARITY_META[opts.rarity];
    const barColors = ['#7C3AED', '#FF3D9A', '#FF5C2B', '#FFD60A', '#00D4AA', '#38BDF8'];
    const hitBursts: { x: number; y: number; color: string; age: number; cat: TrackCategory }[] = [];

    const drawFrame = (elapsed: number) => {
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

      meterNode.getFloatTimeDomainData(meterData);
      const rms = Math.sqrt(meterData.reduce((sum, value) => sum + value * value, 0) / meterData.length);
      const meter = Math.min(1, Math.max(0, (20 * Math.log10(Math.max(rms, 1e-8)) + 56) / 48));
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
    };

    const recording = new Promise<MotionCardExportResult>((resolve, reject) => {
      activeRecorder.onerror = () => reject(new Error('视频编码器录制失败'));
      let finished = false;
      activeRecorder.onstop = () => {
        if (!finished || !chunks.length) reject(new Error('编码器提前停止或输出为空'));
        else resolve({ blob: new Blob(chunks, { type: activeRecorder.mimeType }), mimeType: activeRecorder.mimeType, durationMs, hasAudioTrack: true });
      };
      activeRecorder.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data); };
      const startSec = audio.currentTime;
      let nextEvent = 0;
      const renderFrame = () => {
        try {
          const elapsed = Math.max(0, (audio.currentTime - startSec) * 1000);
          while (nextEvent < opts.snapshot.events.length &&
                 opts.snapshot.events[nextEvent].timeOffsetMs <= elapsed) {
            const ev = opts.snapshot.events[nextEvent++];
            hitBursts.push({ x: 95 + ev.timeOffsetMs / Math.max(1000, opts.snapshot.durationMs) * (W - 190),
              y: 590 - ev.trackIndex * 16, color: ev.color, age: 0, cat: ev.trackCategory });
          }
          drawFrame(elapsed);
          frame = requestAnimationFrame(renderFrame);
        } catch (error) {
          reject(error);
        }
      };
      activeSource.onended = () => {
        finished = true;
        if (activeRecorder.state !== 'inactive') activeRecorder.stop();
      };
      renderFrame();
      activeRecorder.start(100);
      activeSource.start(startSec);
      sourceStarted = true;
      watchdog = window.setTimeout(() => reject(new Error('编码器未在作品结束后完成录制')), durationMs + 5000);
    });
    return await Promise.race([recording, aborted]);
  } finally {
    cancelAnimationFrame(frame);
    window.clearTimeout(watchdog);
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') recorder.stop();
    }
    if (source) {
      source.onended = null;
      if (sourceStarted) source.stop();
      source.disconnect();
    }
    for (const track of tracks) track.stop();
    analyser?.disconnect();
    destination?.disconnect();
    await audio.close();
  }
}
