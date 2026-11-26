import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Disc3,
  Pause,
  Play,
  Redo2,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import { holoAudio } from '../audio/HoloAudioEngine';
import { computeBeatDurationMs } from '../audio/compositionEngine';
import { useHoloSfx } from '../audio/useHoloSfx';
import { CardArtwork } from '../components/artwork/CardArtwork';
import { SoundSourceIcon } from '../components/icons/SoundSourceIcon';
import { BrutalKnob } from '../components/ui/BrutalKnob';
import { BrutalSlider } from '../components/ui/BrutalSlider';
import {
  CATEGORY_META,
  RARITY_META,
  SCALE_META,
  SOUND_CARDS,
  getCardById,
} from '../data/soundCards';
import {
  TRACK_MOTION_PROFILES,
  drawTrackMotifShape,
  evaluateSequencerTrackOrb,
} from '../motion/holoMotion';
import { BEAT_PRESETS, useHoloStore } from '../store/useHoloStore';
import type { BeatPresetId, VariationKind } from '../types/holo';

const VARIATION_BUTTONS: { kind: VariationKind; label: string; tip: string }[] = [
  { kind: 'density_up', label: '加密', tip: '受音乐规则约束增加反拍切分' },
  { kind: 'density_down', label: '精简', tip: '保留正拍重心，精简次要敲击' },
  { kind: 'accent_groove', label: '重拍', tip: '强化强弱对比与律动轻重' },
  { kind: 'breathing_space', label: '留白', tip: '在第 4 拍制造乐句呼吸空间' },
  { kind: 'call_response', label: '问答', tip: '基于 A 段自动生成 B 段回应乐句' },
];

export const BeatDeckPage: React.FC = () => {
  const isPlaying = useHoloStore((s) => s.isPlaying);
  const bpm = useHoloStore((s) => s.bpm);
  const swing = useHoloStore((s) => s.swing);
  const scale = useHoloStore((s) => s.scale);
  const beatBars = useHoloStore((s) => s.beatBars);
  const activePhrase = useHoloStore((s) => s.activePhrase);
  const beatPhraseLoop = useHoloStore((s) => s.beatPhraseLoop);
  const tracks = useHoloStore((s) => s.tracks);
  const liveFx = useHoloStore((s) => s.liveFx);
  const liveFxMode = useHoloStore((s) => s.liveFxMode);
  const collection = useHoloStore((s) => s.collection);
  const beatUndoLen = useHoloStore((s) => s.beatUndoStack.length);
  const beatRedoLen = useHoloStore((s) => s.beatRedoStack.length);
  const beatBounceMode = useHoloStore((s) => s.beatBounceMode);
  const beatStageMode = useHoloStore((s) => s.beatStageMode);
  const beatRemixOrigin = useHoloStore((s) => s.beatRemixOrigin);
  const quantizePreview = useHoloStore((s) => s.pinballQuantizePreview);
  const reducedMotion = useHoloStore((s) => s.reducedMotion);

  const setBpm = useHoloStore((s) => s.setBpm);
  const setSwing = useHoloStore((s) => s.setSwing);
  const setBeatBars = useHoloStore((s) => s.setBeatBars);
  const setActivePhrase = useHoloStore((s) => s.setActivePhrase);
  const setBeatPhraseLoop = useHoloStore((s) => s.setBeatPhraseLoop);
  const copyPhraseAToB = useHoloStore((s) => s.copyPhraseAToB);
  const cycleScale = useHoloStore((s) => s.cycleScale);
  const pushBeatUndo = useHoloStore((s) => s.pushBeatUndo);
  const undoBeat = useHoloStore((s) => s.undoBeat);
  const redoBeat = useHoloStore((s) => s.redoBeat);
  const toggleStep = useHoloStore((s) => s.toggleStep);
  const toggleStepAccent = useHoloStore((s) => s.toggleStepAccent);
  const updateStepCell = useHoloStore((s) => s.updateStepCell);
  const setTrackCard = useHoloStore((s) => s.setTrackCard);
  const setTrackVolume = useHoloStore((s) => s.setTrackVolume);
  const setTrackTone = useHoloStore((s) => s.setTrackTone);
  const toggleTrackMute = useHoloStore((s) => s.toggleTrackMute);
  const toggleTrackSolo = useHoloStore((s) => s.toggleTrackSolo);
  const applyBeatPreset = useHoloStore((s) => s.applyBeatPreset);
  const applyBeatVariation = useHoloStore((s) => s.applyBeatVariation);
  const randomizeBeat = useHoloStore((s) => s.randomizeBeat);
  const clearBeat = useHoloStore((s) => s.clearBeat);
  const setLiveFx = useHoloStore((s) => s.setLiveFx);
  const setLiveFxMode = useHoloStore((s) => s.setLiveFxMode);
  const resetMomentaryFx = useHoloStore((s) => s.resetMomentaryFx);
  const setBeatBounceMode = useHoloStore((s) => s.setBeatBounceMode);
  const setBeatStageMode = useHoloStore((s) => s.setBeatStageMode);
  const sendBeatToForge = useHoloStore((s) => s.sendBeatToForge);
  const performBeatInPinball = useHoloStore((s) => s.performBeatInPinball);
  const updatePinballQuantizeOptions = useHoloStore((s) => s.updatePinballQuantizeOptions);
  const applyPinballQuantize = useHoloStore((s) => s.applyPinballQuantize);
  const pushToast = useHoloStore((s) => s.pushToast);

  const playSfx = useHoloSfx();
  const [activeStep, setActiveStep] = useState<number>(() => holoAudio.getCurrentStep());
  const [swapTrackIdx, setSwapTrackIdx] = useState<number | null>(null);
  const [activePreset, setActivePreset] = useState<BeatPresetId | null>('MARKET');
  const [selectedCell, setSelectedCell] = useState<{ trackIdx: number; stepIdx: number } | null>(null);
  const [fineOpen, setFineOpen] = useState(false);
  const [seatedTrackIdx, setSeatedTrackIdx] = useState<number | null>(null);

  const oledCanvasRef = useRef<HTMLCanvasElement>(null);
  const bounceCanvasRef = useRef<HTMLCanvasElement>(null);
  const matrixGridRef = useRef<HTMLDivElement>(null);
  const orbTrailsRef = useRef<{ x: number; y: number }[][]>([[], [], [], []]);
  const ripplesRef = useRef<{ x: number; y: number; color: string; age: number; maxAge: number }[]>([]);
  const lastStepForRippleRef = useRef(-1);

  const paintModeRef = useRef<{ painting: boolean; value: boolean; trackIdx: number }>({
    painting: false,
    value: true,
    trackIdx: -1,
  });

  useEffect(() => {
    const unsub = holoAudio.subscribeStep((step) => {
      setActiveStep(step);
    });
    return unsub;
  }, []);

  // Safe Keyboard Shortcuts: Space NEVER hijacks INPUT, TEXTAREA, SELECT, BUTTON, A, slider, or contentEditable!
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      const isInteractive =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        tag === 'A' ||
        Boolean(target?.isContentEditable) ||
        target?.getAttribute('role') === 'slider' ||
        target?.getAttribute('role') === 'button';

      if (e.code === 'Space' && !isInteractive) {
        e.preventDefault();
        void holoAudio.togglePlay();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        undoBeat();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        redoBeat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoBeat, redoBeat]);

  useEffect(() => {
    const onUp = () => {
      paintModeRef.current.painting = false;
      resetMomentaryFx();
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [resetMomentaryFx]);

  useEffect(() => {
    holoAudio.syncFromStore();
  }, [bpm, swing, tracks, liveFx]);

  // Retina OLED Master Visualizer (Calm when stopped — never fakes loud output when paused!)
  useEffect(() => {
    let raf = 0;
    const barColors = [
      '#00D4AA', '#00D4AA', '#38BDF8', '#38BDF8',
      '#7C3AED', '#7C3AED', '#FF5C2B', '#FF5C2B',
      '#FFD60A', '#FFD60A',
    ];

    const render = (t: number) => {
      const canvas = oledCanvasRef.current;
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssW = Math.max(120, canvas.clientWidth);
        const cssH = Math.max(36, canvas.clientHeight);
        const targetW = Math.round(cssW * dpr);
        const targetH = Math.round(cssH * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          const w = cssW;
          const h = cssH;
          ctx.fillStyle = '#14151B';
          ctx.fillRect(0, 0, w, h);

          const fft = holoAudio.getFftData();
          const wave = holoAudio.getWaveformData();
          const playing = useHoloStore.getState().isPlaying;

          const spectrumW = Math.min(w * 0.44, 210);
          const barCount = barColors.length;
          const gap = 3.5;
          const bw = (spectrumW - 14 - gap * (barCount - 1)) / barCount;

          for (let i = 0; i < barCount; i++) {
            const db = fft[i + 1] ?? -100;
            const norm = Math.min(1, Math.max(0, (db + 88) / 68));
            const lvl = playing
              ? Math.max(norm, 0.12 + Math.abs(Math.sin(t * 0.007 + i * 0.65)) * 0.16)
              : Math.max(norm, 0.08);
            const bh = Math.max(3, lvl * (h - 12));
            const x = 8 + i * (bw + gap);
            ctx.fillStyle = barColors[i];
            ctx.globalAlpha = playing ? 1 : 0.45;
            ctx.beginPath();
            ctx.roundRect(x, h - 6 - bh, bw, bh, 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          const midX = spectrumW + 6;
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(midX, 8);
          ctx.lineTo(midX, h - 8);
          ctx.stroke();

          const waveStart = midX + 10;
          const waveW = Math.max(40, w - waveStart - 10);
          ctx.strokeStyle = playing ? '#00D4AA' : 'rgba(0, 212, 170, 0.35)';
          ctx.lineWidth = 2.2;
          ctx.beginPath();

          const samples = 48;
          for (let i = 0; i < samples; i++) {
            const idx = Math.floor((i / samples) * wave.length);
            const raw = wave[idx] ?? 0;
            const px = waveStart + (i / (samples - 1)) * waveW;
            const py = h / 2 + raw * (h * 0.44);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  /**
   * Swing-Exact 4-Shape Holo Motion Overlay!
   * Uses real audio-clock millisecond step positions + swing offset + shape-coded motifs
   * (BEAT rounded-square, PERC ring, MELODY diamond-star, VIBE cloud-wave).
   */
  useEffect(() => {
    const sysReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!beatBounceMode || reducedMotion || sysReduced) {
      const c = bounceCanvasRef.current;
      if (c) {
        const ctx = c.getContext('2d');
        ctx?.clearRect(0, 0, c.width, c.height);
      }
      return;
    }

    let raf = 0;
    const renderMotion = () => {
      const canvas = bounceCanvasRef.current;
      const host = matrixGridRef.current;
      if (canvas && host) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssW = Math.max(100, host.clientWidth);
        const cssH = Math.max(100, host.clientHeight);
        const tw = Math.round(cssW * dpr);
        const th = Math.round(cssH * dpr);
        if (canvas.width !== tw || canvas.height !== th) {
          canvas.width = tw;
          canvas.height = th;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, cssW, cssH);

          const state = useHoloStore.getState();
          const playing = state.isPlaying;
          const stepFloatRaw = holoAudio.getTransportStepFloat();
          const viewingOffset = state.beatBars === 2 && state.activePhrase === 'B' ? 16 : 0;
          const playingPhraseOffset = stepFloatRaw >= 16 ? 16 : 0;
          const inViewedPhrase =
            playing && stepFloatRaw >= 0 && playingPhraseOffset === viewingOffset;
          const localStepFloat = inViewedPhrase ? stepFloatRaw % 16 : -1;
          const localStepInt = Math.floor(localStepFloat);
          const anySolo = state.tracks.some((t) => t.solo);

          const padLeft = state.beatStageMode ? 16 : 382;
          const padRight = cssW - 14;
          const padSpan = Math.max(120, padRight - padLeft);
          const colW = padSpan / 16;
          const rowH = cssH / 4;

          if (inViewedPhrase && localStepInt >= 0 && localStepInt !== lastStepForRippleRef.current) {
            lastStepForRippleRef.current = localStepInt;
            state.tracks.forEach((track, tIdx) => {
              const isMuted = track.mute || (anySolo && !track.solo);
              if (isMuted || !track.steps[viewingOffset + localStepInt]) return;
              const rx = padLeft + (localStepInt + 0.5) * colW;
              const ry = (tIdx + 0.55) * rowH;
              if (ripplesRef.current.length < 40) {
                ripplesRef.current.push({
                  x: rx,
                  y: ry,
                  color: CATEGORY_META[track.category].color,
                  age: 0,
                  maxAge: track.category === 'VIBE' ? 30 : 18,
                });
              }
            });
          } else if (!playing) {
            lastStepForRippleRef.current = -1;
          }

          for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
            const rp = ripplesRef.current[i];
            rp.age++;
            if (rp.age >= rp.maxAge) {
              ripplesRef.current.splice(i, 1);
              continue;
            }
            const p = rp.age / rp.maxAge;
            ctx.save();
            ctx.globalAlpha = (1 - p) * 0.78;
            ctx.strokeStyle = rp.color;
            ctx.lineWidth = 2.8 * (1 - p * 0.5);
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, 10 + p * 30, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          if (inViewedPhrase && localStepFloat >= 0) {
            state.tracks.forEach((track, tIdx) => {
              const isMuted = track.mute || (anySolo && !track.solo);
              const trail = orbTrailsRef.current[tIdx];
              if (isMuted) {
                trail.length = 0;
                return;
              }

              const profile = TRACK_MOTION_PROFILES[track.category];
              const rowBaselineY = (tIdx + 0.56) * rowH;
              const velocities = track.stepCells?.map((c) => c.velocity);
              const pose = evaluateSequencerTrackOrb({
                steps: track.steps,
                accents: track.accents,
                velocities,
                category: track.category,
                stepFloat: localStepFloat,
                bpm: state.bpm,
                swing: state.swing,
                phraseOffset: viewingOffset,
                getPadCenter: (sIdx) => ({
                  x: padLeft + (sIdx + 0.5) * colW,
                  y: rowBaselineY,
                }),
                baseArcHeight: Math.min(44, rowH * 0.36),
              });

              if (!pose) {
                trail.length = 0;
                return;
              }

              if (trail.length > 0 && Math.abs(pose.x - trail[trail.length - 1].x) > padSpan * 0.45) {
                trail.length = 0;
              }
              trail.push({ x: pose.x, y: pose.y });
              if (trail.length > profile.trailLength) trail.shift();

              if (trail.length > 1) {
                for (let ti = 1; ti < trail.length; ti++) {
                  const frac = ti / trail.length;
                  ctx.save();
                  ctx.globalAlpha = frac * 0.42;
                  ctx.strokeStyle = profile.color;
                  ctx.lineWidth = 2 + frac * (profile.radius * 1.05);
                  ctx.lineCap = 'round';
                  ctx.beginPath();
                  ctx.moveTo(trail[ti - 1].x, trail[ti - 1].y);
                  ctx.lineTo(trail[ti].x, trail[ti].y);
                  ctx.stroke();
                  ctx.restore();
                }
              }

              // Shape-coded 4-family Sound-Life Motif!
              ctx.save();
              ctx.translate(pose.x, pose.y);
              ctx.scale(pose.scaleX, pose.scaleY);
              ctx.shadowColor = profile.color;
              ctx.shadowBlur = 10 + pose.impact * 10;
              drawTrackMotifShape(ctx, profile.shape, profile.radius, profile.color, '#1A1A1F', pose.impact);
              ctx.restore();
            });
          } else {
            orbTrailsRef.current.forEach((tr) => (tr.length = 0));
          }

          ctx.restore();
        }
      }
      raf = requestAnimationFrame(renderMotion);
    };

    raf = requestAnimationFrame(renderMotion);
    return () => cancelAnimationFrame(raf);
  }, [beatBounceMode, reducedMotion]);

  const phraseOffset = beatBars === 2 && activePhrase === 'B' ? 16 : 0;
  const playingPhrase: 'A' | 'B' | null =
    isPlaying && activeStep >= 0 ? (activeStep >= 16 ? 'B' : 'A') : null;
  const livePlayheadLocal =
    isPlaying && activeStep >= 0 && Math.floor(activeStep / 16) === (activePhrase === 'B' ? 1 : 0)
      ? activeStep % 16
      : -1;
  const anySolo = tracks.some((t) => t.solo);
  const workDurSec = (
    computeBeatDurationMs(bpm, beatBars === 2 && beatPhraseLoop === 'AB' ? 2 : 1) / 1000
  ).toFixed(1);

  const handleLoadPreset = (presetId: BeatPresetId) => {
    playSfx('cartridgeLock');
    setActivePreset(presetId);
    setSelectedCell(null);
    applyBeatPreset(presetId);
    const meta = BEAT_PRESETS[presetId];
    pushToast({
      text: `已装填「${meta.zhTitle}」(${meta.bpm} BPM · ${meta.bars} 小节 A/B · ${SCALE_META[meta.scale].zhLabel})`,
      accent: presetId === 'MARKET' ? '#FFD60A' : presetId === 'NIGHT' ? '#FF5C2B' : '#00D4AA',
    });
  };

  const selectedCellObj =
    selectedCell && tracks[selectedCell.trackIdx]
      ? {
          track: tracks[selectedCell.trackIdx],
          cell: tracks[selectedCell.trackIdx].stepCells?.[selectedCell.stepIdx],
          stepIdx: selectedCell.stepIdx,
          trackIdx: selectedCell.trackIdx,
        }
      : null;

  return (
    <div className="w-full h-full p-3 flex flex-col gap-2.5 overflow-hidden">
      {/* ================= 1. TOP TRANSPORT & MASTER DECK ================= */}
      <section className="brutal-panel px-3 py-2 flex items-center justify-between gap-2.5 shrink-0">
        {/* Left: 播放 / 停止 / 捕获 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            data-testid="beat-play-btn"
            onClick={() => {
              playSfx('click', 0.8);
              void holoAudio.togglePlay();
            }}
            title="播放 / 暂停（空白处按空格键）"
            className={`brutal-btn h-[44px] px-4 rounded-xl flex items-center gap-1.5 text-[14.5px] zh-heading whitespace-nowrap ${
              isPlaying
                ? 'bg-[#FFD60A] text-[#1A1A1F] ring-2 ring-[#1A1A1F]'
                : 'bg-[#00D4AA] text-[#1A1A1F]'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current shrink-0" />
            ) : (
              <Play className="w-4 h-4 fill-current shrink-0" />
            )}
            <span>{isPlaying ? '暂停' : '播放'}</span>
          </button>

          <button
            data-testid="beat-stop-btn"
            onClick={() => {
              playSfx('click', 0.35);
              holoAudio.stopAllPlayback();
              resetMomentaryFx();
            }}
            className="brutal-btn h-[44px] px-3 rounded-xl bg-[#FFFDF8] text-[#1A1A1F] flex items-center gap-1 text-[13.5px] font-bold whitespace-nowrap"
          >
            <Square className="w-3.5 h-3.5 fill-current shrink-0" />
            <span className="hidden xl:inline">停止</span>
          </button>

          <button
            onClick={() => {
              playSfx('mintStamp');
              sendBeatToForge();
            }}
            title={`冻结当前 ${beatBars} 小节作品（${workDurSec}s）送入 04 闪卡铸造`}
            className="brutal-btn h-[44px] px-3 rounded-xl bg-[#FF5C2B] text-[#FFFDF8] flex items-center gap-1.5 text-[13px] font-bold whitespace-nowrap"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFFDF8] border-[1.5px] border-[#1A1A1F] shrink-0" />
            <span>捕获 ({workDurSec}s)</span>
          </button>
        </div>

        {/* Center: OLED Spectrum + 1/2 小节 + 调式锁定 */}
        <div className="relative oled-scanlines flex-1 h-[46px] rounded-2xl bg-[#14151B] border-[2px] border-[#1A1A1F] px-2 flex items-center gap-1.5 min-w-[150px] overflow-hidden">
          <canvas ref={oledCanvasRef} width={340} height={44} className="flex-1 h-full min-w-0 block" />
          <button
            data-testid="beat-bars-btn"
            onClick={() => {
              playSfx('click', 0.65);
              setBeatBars(beatBars === 1 ? 2 : 1);
            }}
            title="切换 1 小节（16 步）或 2 小节独立 A/B 乐句（32 步）"
            className="relative z-10 h-7 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[12px] font-bold text-[#FFD60A] shrink-0 cursor-pointer whitespace-nowrap"
          >
            {beatBars === 2 ? '2 小节 A/B' : '1 小节'}
          </button>
          <button
            onClick={() => {
              playSfx('click', 0.75);
              cycleScale();
            }}
            title={`调式锁定：${SCALE_META[scale].zhLabel}（点击切换）`}
            className="relative z-10 h-7 px-2.5 rounded-full bg-[#FFFDF8] border-[2px] border-[#1A1A1F] text-[12px] font-bold text-[#1A1A1F] flex items-center gap-0.5 shrink-0 cursor-pointer hover:bg-[#FFD60A] transition-colors whitespace-nowrap"
          >
            <span>{SCALE_META[scale].label}</span>
            <ChevronDown className="w-3 h-3 shrink-0" strokeWidth={2.8} />
          </button>
        </div>

        {/* Right: BPM + 6 Presets + Undo/Redo + Fine Tuning Popover */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-[40px] rounded-xl bg-[#FFFDF8] border-[2px] border-[#1A1A1F] shadow-[2px_2px_0px_0px_#1A1A1F] px-1 flex items-center gap-0.5">
            <button
              onClick={() => {
                playSfx('knobTick', 0.3);
                setBpm(bpm - 4);
              }}
              className="p-0.5 hover:bg-[#EDE7D9] rounded-md cursor-pointer"
              aria-label="降低速度"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="px-2 py-0.5 rounded-md bg-[#14151B] font-mono-hw text-[12px] font-bold text-[#FFFDF8] whitespace-nowrap">
              {bpm} BPM
            </div>
            <button
              onClick={() => {
                playSfx('knobTick', 0.8);
                setBpm(bpm + 4);
              }}
              className="p-0.5 hover:bg-[#EDE7D9] rounded-md cursor-pointer"
              aria-label="提高速度"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <BrutalKnob
            value={swing / 0.6}
            onChange={(v) => setSwing(v * 0.6)}
            color="#FFD60A"
            size={32}
            label="摇摆"
            title={`摇摆度：${Math.round(swing * 100)}%（方向键微调）`}
          />

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              {(['MARKET', 'ARCADE', 'NIGHT', 'LOFI', 'RAIN', 'LION'] as BeatPresetId[]).map((pid) => {
                const isSel = activePreset === pid;
                return (
                  <button
                    key={pid}
                    onClick={() => handleLoadPreset(pid)}
                    title={BEAT_PRESETS[pid].zhTitle}
                    className={`brutal-pad px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${
                      isSel
                        ? 'bg-[#FFD60A] text-[#1A1A1F]'
                        : 'bg-[#FFFDF8] text-[#1A1A1F] hover:bg-[#EDE7D9]'
                    }`}
                  >
                    {BEAT_PRESETS[pid].label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  playSfx('click', 0.45);
                  undoBeat();
                }}
                disabled={beatUndoLen === 0}
                title="撤销上一步 (Ctrl+Z)"
                className="brutal-pad px-2 py-0.5 rounded-md bg-[#FFFDF8] disabled:opacity-40 text-[11px] font-bold flex items-center gap-0.5 whitespace-nowrap"
              >
                <Undo2 className="w-3 h-3 shrink-0" />
                <span>撤销</span>
              </button>
              <button
                onClick={() => {
                  playSfx('click', 0.65);
                  redoBeat();
                }}
                disabled={beatRedoLen === 0}
                title="重做 (Ctrl+Y)"
                className="brutal-pad px-1.5 py-0.5 rounded-md bg-[#FFFDF8] disabled:opacity-40 text-[11px] font-bold flex items-center gap-0.5 whitespace-nowrap"
              >
                <Redo2 className="w-3 h-3 shrink-0" />
              </button>
              <button
                onClick={() => {
                  playSfx('ratchet');
                  setActivePreset(null);
                  randomizeBeat();
                }}
                title="受控调式随机生成当前乐句"
                className="brutal-pad px-2 py-0.5 rounded-md bg-[#FFFDF8] hover:bg-[#00D4AA] text-[11px] font-bold flex items-center gap-1 whitespace-nowrap"
              >
                <Shuffle className="w-3 h-3 shrink-0" />
                <span>随机</span>
              </button>
              <button
                onClick={() => {
                  playSfx('click', 0.2);
                  setActivePreset(null);
                  clearBeat();
                }}
                title="清空打击垫（支持 Ctrl+Z 撤销）"
                className="brutal-pad px-2 py-0.5 rounded-md bg-[#FFFDF8] hover:bg-[#FF5C2B] hover:text-white text-[11px] font-bold flex items-center gap-1 whitespace-nowrap"
              >
                <Trash2 className="w-3 h-3 shrink-0" />
                <span>清空</span>
              </button>
              <button
                data-testid="beat-fine-toggle"
                onClick={() => {
                  playSfx('click', 0.7);
                  setFineOpen((v) => !v);
                }}
                title="展开/收起规则变奏与单步精细调节"
                className={`brutal-pad px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 whitespace-nowrap ${
                  fineOpen ? 'bg-[#7C3AED] text-white' : 'bg-[#EDE7D9] text-[#1A1A1F]'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3 shrink-0" />
                <span>精细调节</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PINBALL QUANTIZE LOSS-AWARE PREVIEW BANNER ================= */}
      {quantizePreview && (
        <section
          data-testid="quantize-preview-banner"
          className="px-3.5 py-2 rounded-2xl bg-[#14151B] text-[#FFFDF8] border-[2px] border-[#00D4AA] shadow-[3px_3px_0px_#1A1A1F] flex flex-wrap items-center justify-between gap-2 shrink-0 animate-card-pop"
        >
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-[#00D4AA] text-[#1A1A1F] text-[11.5px] font-bold shrink-0">
              量化预览
            </span>
            <span className="text-[12px] font-medium">
              片段 {(quantizePreview.selectedStartMs / 1000).toFixed(1)}s–{(quantizePreview.selectedEndMs / 1000).toFixed(1)}s · 原 {quantizePreview.selectedSourceEvents} 音符 → 映射 {quantizePreview.mappedCount} 步
              <strong className="text-[#FFD60A] ml-1.5">
                （合并 {quantizePreview.mergedCollisions} 处重叠 · 平均偏移 {quantizePreview.avgShiftMs}ms · 最大 {quantizePreview.maxShiftMs}ms）
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <button
              onClick={() =>
                updatePinballQuantizeOptions({
                  targetBars: quantizePreview.targetBars === 1 ? 2 : 1,
                })
              }
              className="px-2 py-1 rounded-lg bg-white/12 hover:bg-white/20 text-[#FFD60A] text-[11px] font-bold cursor-pointer"
            >
              目标：{quantizePreview.targetBars} 小节
            </button>
            <button
              onClick={() => void holoAudio.playPinballRecording(quantizePreview.sourceEvents)}
              className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
            >
              ▶ 听原录音
            </button>
            <button
              onClick={() => void holoAudio.playQuantizedPreview(quantizePreview, scale)}
              className="px-2.5 py-1 rounded-lg bg-[#7C3AED] hover:brightness-110 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
            >
              ▶ 听量化轨
            </button>
            <button
              onClick={() => {
                playSfx('cartridgeLock');
                applyPinballQuantize('merge');
              }}
              className="brutal-pad px-2.5 py-1 rounded-lg bg-[#00D4AA] text-[#1A1A1F] text-[11.5px] font-bold whitespace-nowrap"
            >
              合并至当前轨
            </button>
            <button
              onClick={() => {
                playSfx('cartridgeLock');
                applyPinballQuantize('replace');
              }}
              className="brutal-pad px-2.5 py-1 rounded-lg bg-[#FFD60A] text-[#1A1A1F] text-[11.5px] font-bold whitespace-nowrap"
            >
              替换
            </button>
            <button
              onClick={() => {
                playSfx('click', 0.3);
                applyPinballQuantize('cancel');
              }}
              className="brutal-pad px-2 py-1 rounded-lg bg-[#FF5C2B] text-white text-[11.5px] font-bold whitespace-nowrap"
            >
              取消
            </button>
          </div>
        </section>
      )}

      {/* ================= COLLAPSIBLE VARIATIONS & SELECTED STEP DETAIL BAR ================= */}
      {(fineOpen || selectedCellObj) && (
        <section
          data-testid="beat-variation-bar"
          className="brutal-panel-sm px-3 py-1.5 flex items-center justify-between gap-3 shrink-0 bg-[#FFFDF8]"
        >
          {/* Rule-Constrained Musical Variations */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] zh-heading text-[#7C3AED] flex items-center gap-1 mr-1">
              <Wand2 className="w-3.5 h-3.5" /> 音乐变奏
            </span>
            {VARIATION_BUTTONS.map((v) => (
              <button
                key={v.kind}
                data-testid={`variation-${v.kind}`}
                onClick={() => {
                  playSfx('click', 0.8);
                  setActivePreset(null);
                  applyBeatVariation(v.kind);
                }}
                title={v.tip}
                className="brutal-pad px-2.5 py-1 rounded-lg bg-[#EDE7D9] hover:bg-[#FFD60A] text-[12px] font-bold text-[#1A1A1F] whitespace-nowrap"
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Selected Step Expressive Detail Editor (Only shown when a step is selected!) */}
          {selectedCellObj && selectedCellObj.cell && (
            <div className="flex items-center gap-2.5 pl-3 border-l-[1.5px] border-[#1A1A1F]/18">
              <span className="text-[11.5px] font-bold text-[#1A1A1F] whitespace-nowrap">
                {CATEGORY_META[selectedCellObj.track.category].label} · 第{' '}
                {(selectedCellObj.stepIdx % 16) + 1} 步
              </span>
              <label className="flex items-center gap-1 text-[11px] font-bold text-[#5E5E6E]">
                力度
                <input
                  type="range"
                  min={40}
                  max={100}
                  value={Math.round(selectedCellObj.cell.velocity * 100)}
                  onChange={(e) => {
                    pushBeatUndo();
                    updateStepCell(selectedCellObj.trackIdx, selectedCellObj.stepIdx, {
                      on: true,
                      velocity: Number(e.target.value) / 100,
                    });
                  }}
                  className="w-16 accent-[#7C3AED]"
                />
                <span className="font-mono-hw w-7">{Math.round(selectedCellObj.cell.velocity * 100)}</span>
              </label>

              {selectedCellObj.track.category === 'MELODY' && (
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#5E5E6E]">
                  <span>音高</span>
                  <button
                    onClick={() => {
                      pushBeatUndo();
                      updateStepCell(selectedCellObj.trackIdx, selectedCellObj.stepIdx, {
                        on: true,
                        pitchOffset: (selectedCellObj.cell?.pitchOffset ?? 0) - 1,
                      });
                    }}
                    className="brutal-pad px-1.5 rounded bg-[#FFFDF8] text-[11px]"
                  >
                    -
                  </button>
                  <span className="font-mono-hw w-5 text-center text-[#1A1A1F]">
                    {selectedCellObj.cell.pitchOffset > 0
                      ? `+${selectedCellObj.cell.pitchOffset}`
                      : selectedCellObj.cell.pitchOffset}
                  </span>
                  <button
                    onClick={() => {
                      pushBeatUndo();
                      updateStepCell(selectedCellObj.trackIdx, selectedCellObj.stepIdx, {
                        on: true,
                        pitchOffset: (selectedCellObj.cell?.pitchOffset ?? 0) + 1,
                      });
                    }}
                    className="brutal-pad px-1.5 rounded bg-[#FFFDF8] text-[11px]"
                  >
                    +
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 text-[11px] font-bold text-[#5E5E6E]">
                <span>时值</span>
                {([1, 2, 4] as const).map((len) => (
                  <button
                    key={len}
                    onClick={() => {
                      pushBeatUndo();
                      updateStepCell(selectedCellObj.trackIdx, selectedCellObj.stepIdx, {
                        on: true,
                        lengthSteps: len,
                      });
                    }}
                    className={`px-1.5 py-0.5 rounded border border-[#1A1A1F] text-[10.5px] font-bold cursor-pointer ${
                      selectedCellObj.cell?.lengthSteps === len
                        ? 'bg-[#00D4AA] text-[#1A1A1F]'
                        : 'bg-[#FFFDF8]'
                    }`}
                  >
                    {len}步
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSelectedCell(null)}
                aria-label="关闭单步微调"
                className="p-0.5 text-[#5E5E6E] hover:text-[#1A1A1F] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>
      )}

      {/* ================= 2. MAIN 4-TRACK SEQUENCER CHASSIS + A/B PHRASE TABS ================= */}
      <section className="brutal-panel flex-1 flex flex-col px-3.5 py-2 min-h-0 overflow-hidden">
        <div
          className={`grid gap-3 items-center pb-1.5 shrink-0 ${
            beatStageMode ? 'grid-cols-[1fr]' : 'grid-cols-[196px_158px_1fr]'
          }`}
        >
          {!beatStageMode && (
            <div className="flex items-center justify-between pl-1 gap-1">
              <span className="text-[12px] font-bold text-[#5E5E6E] whitespace-nowrap">声卡卡槽</span>
              {beatRemixOrigin && (
                <span className="px-2 py-0.5 rounded bg-[#7C3AED] text-white text-[10.5px] font-bold whitespace-nowrap">
                  重混 {beatRemixOrigin.parentCode} · 第{beatRemixOrigin.lineageDepth}代
                </span>
              )}
            </div>
          )}

          {!beatStageMode && (
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => {
                  playSfx('click', 0.75);
                  setBeatBounceMode(!beatBounceMode);
                }}
                title="开启/关闭按实际音频节拍落点的 4 轨跳跃动画"
                className={`px-2 py-0.5 rounded-full border-[1.5px] border-[#1A1A1F] text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                  beatBounceMode ? 'bg-[#00D4AA] text-[#1A1A1F]' : 'bg-[#EDE7D9] text-[#5E5E6E]'
                }`}
              >
                <Activity className="w-3 h-3 shrink-0" />
                <span>跳球 {beatBounceMode ? '开' : '关'}</span>
              </button>
              <button
                onClick={() => {
                  playSfx('click', 0.7);
                  setBeatStageMode(!beatStageMode);
                }}
                title="展开演出宽屏视图"
                className="px-2 py-0.5 rounded-full border-[1.5px] border-[#1A1A1F] bg-[#FFFDF8] hover:bg-[#FFD60A] text-[10.5px] font-bold cursor-pointer whitespace-nowrap"
              >
                演出视图
              </button>
            </div>
          )}

          {/* Right Header: Independent A / B Phrase Controls + 16 Step Numbers */}
          <div className="flex flex-col gap-1">
            {beatBars === 2 && (
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1">
                  {(['A', 'B'] as const).map((ph) => {
                    const editing = activePhrase === ph;
                    const playingNow = playingPhrase === ph;
                    return (
                      <button
                        key={ph}
                        data-testid={`phrase-tab-${ph}`}
                        onClick={() => {
                          playSfx('tab');
                          setActivePhrase(ph);
                        }}
                        className={`px-2.5 py-0.5 rounded-lg border-[1.5px] border-[#1A1A1F] text-[11.5px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                          editing
                            ? 'bg-[#14151B] text-[#FFD60A]'
                            : 'bg-[#EDE7D9] text-[#1A1A1F] hover:bg-[#FFD60A]/50'
                        }`}
                      >
                        {playingNow && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
                        )}
                        <span>{ph} 段（第 {ph === 'A' ? '1–16' : '17–32'} 步）</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      playSfx('cartridgeLock');
                      copyPhraseAToB();
                    }}
                    title="将 A 段完整复制到 B 段作为改编起点"
                    className="px-2 py-0.5 rounded-lg border border-[#1A1A1F]/40 bg-[#FFFDF8] hover:bg-[#00D4AA]/30 text-[11px] font-bold text-[#1A1A1F] flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> 复制 A→B
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-[#5E5E6E] font-bold">循环：</span>
                  {(['AB', 'A', 'B'] as const).map((lp) => (
                    <button
                      key={lp}
                      onClick={() => {
                        playSfx('click', 0.6);
                        setBeatPhraseLoop(lp);
                      }}
                      className={`px-2 py-0.5 rounded-md border border-[#1A1A1F] font-bold cursor-pointer ${
                        beatPhraseLoop === lp
                          ? 'bg-[#7C3AED] text-white'
                          : 'bg-[#FFFDF8] text-[#1A1A1F]'
                      }`}
                    >
                      {lp === 'AB' ? 'A+B' : `仅 ${lp}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              {beatStageMode && (
                <button
                  onClick={() => setBeatStageMode(false)}
                  className="brutal-pad px-2.5 py-0.5 rounded-full bg-[#FFD60A] text-[11px] font-bold shrink-0"
                >
                  ← 返回编曲
                </button>
              )}
              <div className="flex-1 grid grid-cols-16 gap-1.5 px-1">
                {Array.from({ length: 16 }, (_, stepIdx) => {
                  const isGroupStart = stepIdx % 4 === 0;
                  const isHead = livePlayheadLocal === stepIdx;
                  return (
                    <div
                      key={stepIdx}
                      className={`relative flex flex-col items-center justify-center font-mono-hw text-[11px] font-bold transition-all ${
                        isHead
                          ? 'text-[#FF5C2B] scale-115'
                          : isGroupStart
                            ? 'text-[#1A1A1F]'
                            : 'text-[#5E5E6E]'
                      }`}
                    >
                      {isGroupStart && stepIdx > 0 && (
                        <span className="absolute -left-[4px] top-0.5 bottom-0.5 w-[1.5px] bg-[#1A1A1F]/24" />
                      )}
                      <span>{phraseOffset + stepIdx + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 4 Horizontal Track Rows + Live Playhead + Swing-Exact 4-Shape Holo Motion Canvas */}
        <div ref={matrixGridRef} className="flex-1 grid grid-rows-4 gap-2 min-h-0 relative">
          {livePlayheadLocal >= 0 && livePlayheadLocal < 16 && (
            <div
              className={`pointer-events-none absolute inset-0 z-15 grid gap-3 px-2.5 ${
                beatStageMode ? 'grid-cols-[1fr]' : 'grid-cols-[196px_158px_1fr]'
              }`}
            >
              {!beatStageMode && <div />}
              {!beatStageMode && <div />}
              <div className="grid grid-cols-16 gap-1.5 px-1 h-full">
                {Array.from({ length: 16 }, (_, idx) => (
                  <div
                    key={idx}
                    className={
                      idx === livePlayheadLocal
                        ? 'h-full -my-0.5 rounded-xl border-[2px] border-[#FFD60A] bg-[#FFD60A]/12'
                        : ''
                    }
                  />
                ))}
              </div>
            </div>
          )}

          <canvas
            ref={bounceCanvasRef}
            className="pointer-events-none absolute inset-0 w-full h-full z-25"
          />

          {tracks.map((track, trackIdx) => {
            const card = getCardById(track.cardId);
            const catMeta = CATEGORY_META[track.category];
            const rarMeta = RARITY_META[card.rarity];
            const isMuted = track.mute || (anySolo && !track.solo);
            const isRowFiring =
              !isMuted && livePlayheadLocal >= 0 && track.steps[phraseOffset + livePlayheadLocal];
            const ghostRow = quantizePreview?.ghostSteps[trackIdx];

            return (
              <div
                key={track.category}
                className={`grid gap-3 items-center rounded-2xl border-[2px] px-2.5 py-1.5 transition-all ${
                  beatStageMode ? 'grid-cols-[1fr]' : 'grid-cols-[196px_158px_1fr]'
                } ${
                  isMuted
                    ? 'border-[#1A1A1F]/30 bg-[#F7F3E9]/70 opacity-60'
                    : 'border-[#1A1A1F]/85 bg-[#FFFDF8]'
                }`}
              >
                {/* Cartridge Slot with SoundSourceIcon + Lock-in Animation */}
                {!beatStageMode && (
                  <div
                    className={`flex items-stretch gap-1.5 h-full max-h-[76px] min-h-[58px] ${
                      seatedTrackIdx === trackIdx ? 'animate-cartridge-seat' : ''
                    }`}
                  >
                    <button
                      onClick={() => void holoAudio.previewCard(card.id)}
                      title={`点击试听：${card.zhTitle}（${catMeta.zhLabel}）`}
                      className={`flex-1 rounded-xl bg-[#14151B] border-[2px] border-[#1A1A1F] p-[3px] flex flex-col overflow-hidden cursor-pointer transition-transform duration-100 ${
                        isRowFiring ? 'scale-[1.02] ring-2 ring-[#FFD60A]' : 'hover:brightness-105'
                      }`}
                    >
                      <div
                        className="border-b-[1.5px] border-[#1A1A1F] rounded-t-[6px] px-2 py-[2px] flex items-center justify-between"
                        style={{ backgroundColor: catMeta.color, color: catMeta.textColor }}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full border border-[#1A1A1F]/50 ${
                            isRowFiring ? 'bg-white scale-125' : 'bg-[#1A1A1F]/35'
                          }`}
                        />
                        <span className="text-[11px] font-bold leading-none whitespace-nowrap">
                          {catMeta.label}
                        </span>
                        <span className="font-mono-hw text-[10px] font-bold opacity-85 leading-none">
                          {card.code}
                        </span>
                      </div>
                      <div className="relative flex-1 rounded-b-[6px] overflow-hidden flex items-center bg-[#1E1F28] px-1.5 gap-1.5">
                        <div className="w-9 h-9 rounded-lg bg-[#FFFDF8] border border-[#1A1A1F] flex items-center justify-center shrink-0">
                          <SoundSourceIcon cardId={card.id} size={24} />
                        </div>
                        <div className="flex-1 flex flex-col justify-center text-left min-w-0">
                          <span
                            className="self-start px-1 py-[0.5px] rounded text-[9px] font-bold border border-[#1A1A1F]"
                            style={{ backgroundColor: rarMeta.bg, color: rarMeta.text }}
                          >
                            {rarMeta.label}
                          </span>
                          <div className="text-[12px] font-bold text-[#FFFDF8] truncate leading-tight mt-0.5">
                            {card.shortTitle}
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        playSfx('click', 0.7);
                        setSwapTrackIdx(trackIdx);
                      }}
                      title="弹出更换此轨道声卡（不清空当前节奏）"
                      aria-label={`更换${catMeta.label}轨道声卡`}
                      className="brutal-pad w-7 rounded-xl bg-[#FFFDF8] hover:bg-[#FFD60A] flex flex-col items-center justify-center shrink-0"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-[#1A1A1F]">
                        <polygon points="8,3 14,10 2,10" />
                        <rect x="2" y="12" width="12" height="2" rx="0.5" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Channel Mixer */}
                {!beatStageMode && (
                  <div className="flex items-center gap-2 px-1.5 border-x-[1.5px] border-[#1A1A1F]/12 h-full">
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => {
                          playSfx('click', 0.4);
                          toggleTrackMute(trackIdx);
                        }}
                        title="静音"
                        aria-pressed={track.mute}
                        className={`w-6.5 h-6 rounded-md border-[1.5px] border-[#1A1A1F] text-[11px] font-bold cursor-pointer transition-colors ${
                          track.mute
                            ? 'bg-[#FF5C2B] text-white'
                            : 'bg-[#FFFDF8] text-[#1A1A1F] hover:bg-[#EDE7D9]'
                        }`}
                      >
                        静
                      </button>
                      <button
                        onClick={() => {
                          playSfx('click', 0.7);
                          toggleTrackSolo(trackIdx);
                        }}
                        title="独奏"
                        aria-pressed={track.solo}
                        className={`w-6.5 h-6 rounded-md border-[1.5px] border-[#1A1A1F] text-[11px] font-bold cursor-pointer transition-colors ${
                          track.solo
                            ? 'bg-[#FFD60A] text-[#1A1A1F]'
                            : 'bg-[#FFFDF8] text-[#1A1A1F] hover:bg-[#EDE7D9]'
                        }`}
                      >
                        独
                      </button>
                    </div>

                    <BrutalKnob
                      value={track.tone}
                      onChange={(val) => setTrackTone(trackIdx, val)}
                      color={catMeta.color}
                      size={32}
                      label="音色"
                      title="拖拽、滚轮或方向键调节滤波与音色明亮度"
                    />

                    <BrutalSlider
                      value={track.volume}
                      onChange={(val) => setTrackVolume(trackIdx, val)}
                      color={catMeta.color}
                      label="音量"
                      height={12}
                      className="flex-1 min-w-[46px]"
                    />
                  </div>
                )}

                {/* 16-Step Matrix for Active Phrase (A = 0..15 or B = 16..31) */}
                <div className="grid grid-cols-16 gap-1.5 h-full items-center px-1 relative">
                  {Array.from({ length: 16 }, (_, localIdx) => {
                    const globalIdx = phraseOffset + localIdx;
                    const isOn = Boolean(track.steps[globalIdx]);
                    const cell = track.stepCells?.[globalIdx];
                    const isHead = livePlayheadLocal === localIdx;
                    const isAccented = Boolean(track.accents?.[globalIdx]) && isOn;
                    const isGhost = Boolean(ghostRow?.[globalIdx]) && !isOn;
                    const isSelectedStep =
                      selectedCell?.trackIdx === trackIdx && selectedCell?.stepIdx === globalIdx;
                    const isBeatB = Math.floor(localIdx / 4) % 2 === 1;
                    const offBg = isBeatB ? '#E2DACB' : '#EFEAE0';

                    return (
                      <button
                        key={localIdx}
                        data-testid={`pad-${trackIdx}-${globalIdx}`}
                        aria-pressed={isOn}
                        onClick={(e) => {
                          if (e.detail !== 0) return;
                          pushBeatUndo();
                          setSelectedCell({trackIdx,stepIdx:globalIdx});
                          toggleStep(trackIdx,globalIdx,!isOn);
                          if (!isOn) void holoAudio.previewCard(card.id,{stepIndex:globalIdx,tone:track.tone});
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          pushBeatUndo();
                          toggleStepAccent(trackIdx, globalIdx);
                          setSelectedCell({ trackIdx, stepIdx: globalIdx });
                          void holoAudio.previewCard(card.id, {
                            stepIndex: globalIdx,
                            tone: track.tone,
                            velocity: 0.98,
                          });
                        }}
                        onPointerDown={(e) => {
                          if (e.button === 2) return;
                          e.preventDefault();
                          pushBeatUndo();
                          if (e.altKey) {
                            setSelectedCell({ trackIdx, stepIdx: globalIdx });
                            return;
                          }
                          if (e.shiftKey) {
                            toggleStepAccent(trackIdx, globalIdx);
                            setSelectedCell({ trackIdx, stepIdx: globalIdx });
                            void holoAudio.previewCard(card.id, {
                              stepIndex: globalIdx,
                              tone: track.tone,
                              velocity: 0.98,
                            });
                            return;
                          }
                          const nextVal = !isOn;
                          paintModeRef.current = {
                            painting: true,
                            value: nextVal,
                            trackIdx,
                          };
                          setActivePreset(null);
                          toggleStep(trackIdx, globalIdx, nextVal);
                          if (nextVal) {
                            setSelectedCell({ trackIdx, stepIdx: globalIdx });
                            void holoAudio.previewCard(card.id, {
                              stepIndex: globalIdx,
                              tone: track.tone,
                              velocity: cell?.velocity ?? 0.78,
                            });
                          } else {
                            playSfx('click', 0.25);
                          }
                        }}
                        onPointerEnter={() => {
                          if (
                            paintModeRef.current.painting &&
                            paintModeRef.current.trackIdx === trackIdx
                          ) {
                            toggleStep(trackIdx, globalIdx, paintModeRef.current.value);
                          }
                        }}
                        style={{
                          backgroundColor: isOn ? catMeta.color : offBg,
                        }}
                        title="点击开关并选中微调 · 拖拽涂抹 · 右键/Shift 切换重音"
                        className={`relative h-[74%] min-h-[40px] max-h-[74px] w-full rounded-[10px] brutal-pad ${
                          isHead && isOn ? 'animate-pad-hit z-10 ring-2 ring-white' : ''
                        } ${isAccented ? 'ring-2 ring-[#FFD60A]' : ''} ${
                          isSelectedStep ? 'outline-2 outline-[#1A1A1F] outline-offset-1' : ''
                        } ${
                          isGhost ? 'border-dashed !border-[#00D4AA] ring-2 ring-[#00D4AA]/60' : ''
                        }`}
                        aria-label={`${catMeta.label} 第 ${globalIdx + 1} 步`}
                      >
                        {isOn && (
                          <>
                            <span
                              className="absolute inset-x-1.5 top-1 h-1 rounded-full bg-white/40 pointer-events-none"
                              style={{ opacity: Math.max(0.25, cell?.velocity ?? 0.8) }}
                            />
                            {cell && cell.pitchOffset !== 0 && track.category === 'MELODY' && (
                              <span className="absolute inset-0 flex items-center justify-center font-mono-hw text-[9px] font-bold text-[#1A1A1F] pointer-events-none">
                                {cell.pitchOffset > 0 ? `+${cell.pitchOffset}` : cell.pitchOffset}
                              </span>
                            )}
                            <span
                              className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full pointer-events-none ${
                                isAccented
                                  ? 'w-2.5 h-1 bg-[#FFD60A]'
                                  : 'w-2 h-[3px] bg-[#1A1A1F]/35'
                              }`}
                            />
                          </>
                        )}
                        {isGhost && (
                          <span
                            className="absolute inset-1.5 rounded-[6px] opacity-45 pointer-events-none"
                            style={{ backgroundColor: catMeta.color }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= 3. BOTTOM LIVE FX (LATCH / MOMENTARY) + NEXT-STEP CTA ================= */}
      <section className="flex items-center gap-2.5 shrink-0">
        {/* FX Mode Toggle: Latch vs Momentary */}
        <button
          data-testid="fx-mode-toggle"
          onClick={() => {
            playSfx('click', 0.6);
            setLiveFxMode(liveFxMode === 'latch' ? 'momentary' : 'latch');
          }}
          title="切换效果器触发方式：锁定开关 vs 按住瞬间生效"
          className="brutal-pad h-[46px] px-2.5 rounded-xl bg-[#FFFDF8] text-[#1A1A1F] text-[11px] font-bold leading-tight text-center shrink-0 whitespace-nowrap"
        >
          <span className="block text-[#5E5E6E] text-[10px]">效果模式</span>
          <span className="text-[#7C3AED]">{liveFxMode === 'latch' ? '锁定开关' : '按住生效'}</span>
        </button>

        <div className="flex-1 grid grid-cols-3 gap-2">
          {[
            { key: 'bitcrush' as const, label: '像素碎音', bg: '#7C3AED', text: '#FFFFFF' },
            { key: 'echo' as const, label: '街巷回声', bg: '#FF5C2B', text: '#FFFFFF' },
            { key: 'stutter' as const, label: '切拍重复', bg: '#00D4AA', text: '#1A1A1F' },
          ].map((fx) => {
            const active = liveFx[fx.key];
            return (
              <button
                key={fx.key}
                data-testid={`fx-${fx.key}`}
                onKeyDown={(e) => {
                  if (liveFxMode === 'momentary' && [' ','Enter'].includes(e.key)) {
                    e.preventDefault();
                    if (!e.repeat) setLiveFx(fx.key,true);
                  }
                }}
                onKeyUp={(e) => {
                  if (liveFxMode === 'momentary' && [' ','Enter'].includes(e.key)) {
                    e.preventDefault();
                    setLiveFx(fx.key,false);
                  }
                }}
                onBlur={() => { if (liveFxMode === 'momentary') setLiveFx(fx.key,false); }}
                onPointerCancel={() => { if (liveFxMode === 'momentary') setLiveFx(fx.key,false); }}
                aria-pressed={active}
                onPointerDown={() => {
                  if (liveFxMode === 'momentary') {
                    playSfx('click', 0.9);
                    setLiveFx(fx.key, true);
                  }
                }}
                onPointerUp={() => {
                  if (liveFxMode === 'momentary') {
                    setLiveFx(fx.key, false);
                  }
                }}
                onPointerLeave={() => {
                  if (liveFxMode === 'momentary' && active) {
                    setLiveFx(fx.key, false);
                  }
                }}
                onClick={() => {
                  if (liveFxMode === 'latch') {
                    playSfx('click', active ? 0.35 : 0.9);
                    setLiveFx(fx.key, !active);
                  }
                }}
                style={{ backgroundColor: fx.bg, color: fx.text }}
                className={`brutal-btn h-[46px] px-3.5 rounded-xl flex items-center justify-between whitespace-nowrap ${
                  active ? 'brutal-btn-pressed ring-2 ring-[#FFD60A]' : ''
                }`}
              >
                <span
                  className={`w-3 h-3 rounded-full border-[2px] border-[#1A1A1F] shrink-0 ${
                    active ? 'bg-[#FFD60A]' : 'bg-[#FFFDF8]/75'
                  }`}
                />
                <span className="text-[14.5px] zh-heading">{fx.label}</span>
                <span className="text-[11px] font-bold opacity-85">
                  {active ? '开' : liveFxMode === 'momentary' ? '按住' : '关'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="h-8 w-[1.5px] bg-[#1A1A1F]/18 shrink-0" />

        <button
          data-testid="beat-to-pinball-btn"
          onClick={() => {
            playSfx('portalWarp');
            holoAudio.stopAllPlayback();
            performBeatInPinball();
          }}
          title={`冻结当前 ${beatBars} 小节（${workDurSec}s）送入弹珠剧场演出`}
          className="brutal-btn-lg h-[46px] px-4 rounded-2xl bg-[#14151B] text-[#00D4AA] text-[14px] zh-heading flex items-center gap-1.5 shrink-0 whitespace-nowrap"
        >
          <Disc3 className="w-4 h-4 shrink-0" />
          <span>进入弹珠剧场</span>
        </button>

        <button
          data-testid="beat-to-forge-btn"
          onClick={() => {
            playSfx('mintStamp');
            sendBeatToForge();
          }}
          className="brutal-btn-lg h-[46px] px-5 rounded-2xl bg-[#FFD60A] text-[#1A1A1F] text-[14.5px] zh-display flex items-center gap-1.5 shrink-0 whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>铸造这张节拍卡 →</span>
        </button>
      </section>

      {/* ================= CARTRIDGE SWAP MODAL ================= */}
      {swapTrackIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/48 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setSwapTrackIdx(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="brutal-panel w-[540px] max-w-full max-h-[80vh] flex flex-col overflow-hidden animate-card-pop"
          >
            <div className="px-4 py-3 bg-[#FFD60A] border-b-[2.5px] border-[#1A1A1F] flex items-center justify-between">
              <div>
                <h3 className="text-[17px] zh-display text-[#1A1A1F]">
                  更换「{CATEGORY_META[tracks[swapTrackIdx].category].zhLabel}」轨道声卡
                </h3>
                <p className="text-[12px] font-medium text-[#1A1A1F]/80">
                  换卡仅切换音色，当前 A/B 节奏格保持完整不变
                </p>
              </div>
              <button
                onClick={() => setSwapTrackIdx(null)}
                aria-label="关闭换卡窗口"
                className="brutal-btn w-8 h-8 rounded-lg bg-[#FFFDF8] flex items-center justify-center"
              >
                <X className="w-4 h-4" strokeWidth={2.8} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto holo-scroll grid grid-cols-2 gap-3 bg-[#F7F3E9]">
              {SOUND_CARDS.filter((c) => collection.includes(c.id))
                .sort((a, b) => {
                  const pref = tracks[swapTrackIdx].category;
                  return (a.category === pref ? -1 : 1) - (b.category === pref ? -1 : 1);
                })
                .map((c) => {
                  const isSelected = tracks[swapTrackIdx].cardId === c.id;
                  const cat = CATEGORY_META[c.category];
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        playSfx('cartridgeLock');
                        setTrackCard(swapTrackIdx, c.id);
                        setSeatedTrackIdx(swapTrackIdx);
                        window.setTimeout(() => setSeatedTrackIdx(null), 320);
                        void holoAudio.previewCard(c.id);
                        setSwapTrackIdx(null);
                      }}
                      className={`p-2 rounded-xl border-[2px] border-[#1A1A1F] flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFD60A] shadow-[3px_3px_0px_0px_#1A1A1F]'
                          : 'bg-[#FFFDF8] hover:bg-[#EDE7D9] shadow-[2px_2px_0px_0px_#1A1A1F]'
                      }`}
                    >
                      <div className="w-12 h-14 rounded-lg border-[1.5px] border-[#1A1A1F] overflow-hidden shrink-0">
                        <CardArtwork artId={c.artId} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-[#1A1A1F]"
                            style={{ backgroundColor: cat.color, color: cat.textColor }}
                          >
                            {cat.label}
                          </span>
                          <span className="font-mono-hw text-[10.5px] font-bold">{c.code}</span>
                        </div>
                        <div className="text-[13px] font-bold truncate mt-1 text-[#1A1A1F]">
                          {c.zhTitle}
                        </div>
                        <div className="text-[11px] text-[#5E5E6E] truncate">
                          推荐 {c.recommendedBpm} BPM
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
