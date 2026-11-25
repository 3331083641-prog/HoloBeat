import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Pause,
  Play,
  Redo2,
  Shuffle,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { holoAudio } from '../audio/HoloAudioEngine';
import { useHoloSfx } from '../audio/useHoloSfx';
import { CardArtwork } from '../components/artwork/CardArtwork';
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
  evaluateSequencerTrackOrb,
} from '../motion/holoMotion';
import { BEAT_PRESETS, useHoloStore } from '../store/useHoloStore';
import type { BeatPresetId } from '../types/holo';

export const BeatDeckPage: React.FC = () => {
  const isPlaying = useHoloStore((s) => s.isPlaying);
  const bpm = useHoloStore((s) => s.bpm);
  const swing = useHoloStore((s) => s.swing);
  const scale = useHoloStore((s) => s.scale);
  const beatBars = useHoloStore((s) => s.beatBars);
  const tracks = useHoloStore((s) => s.tracks);
  const liveFx = useHoloStore((s) => s.liveFx);
  const collection = useHoloStore((s) => s.collection);
  const beatUndoLen = useHoloStore((s) => s.beatUndoStack.length);
  const beatRedoLen = useHoloStore((s) => s.beatRedoStack.length);
  const beatBounceMode = useHoloStore((s) => s.beatBounceMode);
  const beatStageMode = useHoloStore((s) => s.beatStageMode);
  const beatRemixOrigin = useHoloStore((s) => s.beatRemixOrigin);
  const quantizePreview = useHoloStore((s) => s.pinballQuantizePreview);

  const setBpm = useHoloStore((s) => s.setBpm);
  const setSwing = useHoloStore((s) => s.setSwing);
  const setBeatBars = useHoloStore((s) => s.setBeatBars);
  const cycleScale = useHoloStore((s) => s.cycleScale);
  const pushBeatUndo = useHoloStore((s) => s.pushBeatUndo);
  const undoBeat = useHoloStore((s) => s.undoBeat);
  const redoBeat = useHoloStore((s) => s.redoBeat);
  const toggleStep = useHoloStore((s) => s.toggleStep);
  const toggleStepAccent = useHoloStore((s) => s.toggleStepAccent);
  const setTrackCard = useHoloStore((s) => s.setTrackCard);
  const setTrackVolume = useHoloStore((s) => s.setTrackVolume);
  const setTrackTone = useHoloStore((s) => s.setTrackTone);
  const toggleTrackMute = useHoloStore((s) => s.toggleTrackMute);
  const toggleTrackSolo = useHoloStore((s) => s.toggleTrackSolo);
  const applyBeatPreset = useHoloStore((s) => s.applyBeatPreset);
  const randomizeBeat = useHoloStore((s) => s.randomizeBeat);
  const clearBeat = useHoloStore((s) => s.clearBeat);
  const setLiveFx = useHoloStore((s) => s.setLiveFx);
  const setBeatBounceMode = useHoloStore((s) => s.setBeatBounceMode);
  const setBeatStageMode = useHoloStore((s) => s.setBeatStageMode);
  const sendBeatToForge = useHoloStore((s) => s.sendBeatToForge);
  const performBeatInPinball = useHoloStore((s) => s.performBeatInPinball);
  const applyPinballQuantize = useHoloStore((s) => s.applyPinballQuantize);
  const pushToast = useHoloStore((s) => s.pushToast);

  const playSfx = useHoloSfx();
  const [activeStep, setActiveStep] = useState<number>(() => holoAudio.getCurrentStep());
  const [swapTrackIdx, setSwapTrackIdx] = useState<number | null>(null);
  const [activePreset, setActivePreset] = useState<BeatPresetId | null>('MARKET');

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

  // Keyboard shortcuts: Space (Play/Pause), Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        void holoAudio.togglePlay();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoBeat();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
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
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, []);

  useEffect(() => {
    holoAudio.syncFromStore();
  }, [bpm, swing, tracks, liveFx]);

  // 60fps Retina Master OLED Spectrum + Oscilloscope Visualizer
  useEffect(() => {
    let raf = 0;
    const barColors = [
      '#00D4AA', '#00D4AA', '#38BDF8', '#38BDF8',
      '#7C3AED', '#A855F7', '#FF3D9A', '#FF3D9A',
      '#FF5526', '#FF5526', '#FFD426', '#FFD426',
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

          const spectrumW = Math.min(w * 0.44, 240);
          const barCount = barColors.length;
          const gap = 3.5;
          const bw = (spectrumW - 14 - gap * (barCount - 1)) / barCount;

          for (let i = 0; i < barCount; i++) {
            const db = fft[i + 1] ?? -100;
            const norm = Math.min(1, Math.max(0, (db + 88) / 68));
            const idle = playing
              ? 0.22 + Math.abs(Math.sin(t * 0.008 + i * 0.7)) * 0.55
              : 0.14 + Math.sin(((i + 0.5) / barCount) * Math.PI) * (0.42 + Math.sin(t * 0.003 + i) * 0.1);
            const lvl = Math.max(norm, idle * (playing ? 0.85 : 0.65));
            const bh = Math.max(4, lvl * (h - 12));
            const x = 8 + i * (bw + gap);
            ctx.fillStyle = barColors[i];
            ctx.beginPath();
            ctx.roundRect(x, h - 6 - bh, bw, bh, 2);
            ctx.fill();
          }

          const midX = spectrumW + 6;
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(midX, 8);
          ctx.lineTo(midX, h - 8);
          ctx.stroke();

          const waveStart = midX + 10;
          const waveW = Math.max(40, w - waveStart - 10);
          const grad = ctx.createLinearGradient(waveStart, 0, waveStart + waveW, 0);
          grad.addColorStop(0, '#00D4AA');
          grad.addColorStop(0.5, '#38BDF8');
          grad.addColorStop(1, '#FF3D9A');

          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.4;
          ctx.shadowColor = '#00D4AA';
          ctx.shadowBlur = 6;
          ctx.beginPath();

          const samples = 56;
          for (let i = 0; i < samples; i++) {
            const idx = Math.floor((i / samples) * wave.length);
            const raw = wave[idx] ?? 0;
            const idleWave =
              Math.sin(i * 0.55 + t * 0.006) *
              Math.sin((i / (samples - 1)) * Math.PI) *
              (playing ? 0.36 : 0.24);
            const val = Math.abs(raw) > 0.01 ? raw * 1.5 : idleWave;
            const px = waveStart + (i / (samples - 1)) * waveW;
            const py = h / 2 + val * (h * 0.42);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  /**
   * HOLO MOTION · 声音生命跳跃动画层 (Audio-Clock Synchronized Parabolic Orbs!)
   * Driven strictly by Tone.Transport.seconds via holoAudio.getTransportStepFloat().
   * Respects Mute, Solo, Empty tracks, Pause, Resume, BPM changes, and Loop Wrap!
   */
  useEffect(() => {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!beatBounceMode || prefersReduced) {
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
          const stepFloat = holoAudio.getTransportStepFloat();
          const stepInt = Math.floor(stepFloat);
          const anySolo = state.tracks.some((t) => t.solo);

          // Pad matrix geometry inside the 4-row container (matches left 194px + 162px + gaps)
          const padLeft = state.beatStageMode ? 16 : 388;
          const padRight = cssW - 14;
          const padSpan = Math.max(120, padRight - padLeft);
          const colW = padSpan / 16;
          const rowH = cssH / 4;

          // Spawn crisp localized impact ripples when audio clock crosses an active pad!
          if (playing && stepInt >= 0 && stepInt !== lastStepForRippleRef.current) {
            lastStepForRippleRef.current = stepInt;
            state.tracks.forEach((track, tIdx) => {
              const isMuted = track.mute || (anySolo && !track.solo);
              if (isMuted || !track.steps[stepInt]) return;
              const rx = padLeft + (stepInt + 0.5) * colW;
              const ry = (tIdx + 0.55) * rowH;
              if (ripplesRef.current.length < 48) {
                ripplesRef.current.push({
                  x: rx,
                  y: ry,
                  color: CATEGORY_META[track.category].color,
                  age: 0,
                  maxAge: track.category === 'VIBE' ? 32 : 20,
                });
              }
            });
          } else if (!playing) {
            lastStepForRippleRef.current = -1;
          }

          // Render decaying impact ripples
          for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
            const rp = ripplesRef.current[i];
            rp.age++;
            if (rp.age >= rp.maxAge) {
              ripplesRef.current.splice(i, 1);
              continue;
            }
            const p = rp.age / rp.maxAge;
            ctx.save();
            ctx.globalAlpha = (1 - p) * 0.8;
            ctx.strokeStyle = rp.color;
            ctx.lineWidth = 3 * (1 - p * 0.5);
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, 10 + p * 34, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // Render 4 independent sound-life parabolic orbs!
          if (playing && stepFloat >= 0) {
            state.tracks.forEach((track, tIdx) => {
              const isMuted = track.mute || (anySolo && !track.solo);
              const trail = orbTrailsRef.current[tIdx];
              if (isMuted) {
                trail.length = 0;
                return;
              }

              const profile = TRACK_MOTION_PROFILES[track.category];
              const rowBaselineY = (tIdx + 0.56) * rowH;
              const pose = evaluateSequencerTrackOrb({
                steps: track.steps,
                accents: track.accents,
                category: track.category,
                stepFloat,
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

              // Reset trail cleanly on horizontal loop wrap to avoid ugly line across whole screen
              if (trail.length > 0 && Math.abs(pose.x - trail[trail.length - 1].x) > padSpan * 0.45) {
                trail.length = 0;
              }
              trail.push({ x: pose.x, y: pose.y });
              if (trail.length > profile.trailLength) trail.shift();

              // Luminous Comet Arc Trail
              if (trail.length > 1) {
                for (let ti = 1; ti < trail.length; ti++) {
                  const frac = ti / trail.length;
                  ctx.save();
                  ctx.globalAlpha = frac * 0.45;
                  ctx.strokeStyle = profile.color;
                  ctx.lineWidth = 2 + frac * (profile.radius * 1.15);
                  ctx.lineCap = 'round';
                  ctx.beginPath();
                  ctx.moveTo(trail[ti - 1].x, trail[ti - 1].y);
                  ctx.lineTo(trail[ti].x, trail[ti].y);
                  ctx.stroke();
                  ctx.restore();
                }
              }

              // Glowing Sound-Life Orb with Impact Squash & Stretch
              ctx.save();
              ctx.translate(pose.x, pose.y);
              ctx.scale(pose.scaleX, pose.scaleY);

              ctx.shadowColor = profile.color;
              ctx.shadowBlur = 12 + pose.impact * 10;
              ctx.fillStyle = profile.color;
              ctx.strokeStyle = '#17171C';
              ctx.lineWidth = 2.4;
              ctx.beginPath();
              ctx.arc(0, 0, profile.radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // Crisp white specular core
              ctx.shadowBlur = 0;
              ctx.fillStyle = '#FFFDF8';
              ctx.beginPath();
              ctx.arc(-profile.radius * 0.28, -profile.radius * 0.28, profile.radius * 0.32, 0, Math.PI * 2);
              ctx.fill();
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
  }, [beatBounceMode]);

  const livePlayhead = isPlaying && activeStep >= 0 ? activeStep : -1;
  const anySolo = tracks.some((t) => t.solo);

  const handleLoadPreset = (presetId: BeatPresetId) => {
    playSfx('cartridgeLock');
    setActivePreset(presetId);
    applyBeatPreset(presetId);
    const meta = BEAT_PRESETS[presetId];
    pushToast({
      text: `♪ 已装填「${meta.zhTitle}」(${meta.bpm} BPM · ${SCALE_META[meta.scale].zhLabel})`,
      accent: presetId === 'MARKET' ? '#FFD426' : presetId === 'NIGHT' ? '#7C3AED' : '#00D4AA',
    });
  };

  return (
    <div className="w-full h-full p-3 flex flex-col gap-2.5 overflow-hidden">
      {/* ================= 1. TOP TRANSPORT & MASTER OLED DECK ================= */}
      <section className="brutal-panel px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        {/* Left: 播放 / 停止 / 捕获作品 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              playSfx('click', 0.8);
              void holoAudio.togglePlay();
            }}
            title="播放 / 暂停（快捷键空格）"
            className={`brutal-btn h-[46px] px-3.5 rounded-xl flex items-center gap-1.5 text-[13.5px] zh-display whitespace-nowrap ${
              isPlaying
                ? 'bg-[#FFD426] text-[#17171C] ring-2 ring-[#17171C]'
                : 'bg-[#00D4AA] text-[#17171C]'
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
            onClick={() => {
              playSfx('click', 0.35);
              holoAudio.stopTransport();
            }}
            className="brutal-btn h-[46px] px-2.5 rounded-xl bg-[#FBF9F4] text-[#17171C] flex items-center gap-1 text-[13px] font-black whitespace-nowrap"
          >
            <Square className="w-3.5 h-3.5 fill-current shrink-0" />
            <span className="hidden xl:inline">停止</span>
          </button>

          <button
            onClick={() => {
              playSfx('mintStamp');
              sendBeatToForge();
            }}
            title="立即冻结当前编曲快照送入 04 闪卡铸造"
            className="brutal-btn h-[46px] px-3 rounded-xl bg-[#FF5526] text-[#17171C] flex items-center gap-1.5 text-[12px] font-black whitespace-nowrap"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#FBF9F4] border-[2px] border-[#17171C] shrink-0" />
            <span>捕获作品</span>
          </button>
        </div>

        {/* Center: Retina OLED Visualizer + Scale Lock + Loop Bars */}
        <div className="relative oled-scanlines flex-1 h-[48px] rounded-2xl bg-[#14151B] border-[2.5px] border-[#17171C] shadow-[inset_0_3px_10px_rgba(0,0,0,0.65)] px-2 flex items-center gap-1.5 min-w-[160px] overflow-hidden">
          <canvas
            ref={oledCanvasRef}
            width={360}
            height={46}
            className="flex-1 h-full min-w-0 block"
          />
          <button
            onClick={() => {
              playSfx('click', 0.65);
              setBeatBars(beatBars === 1 ? 2 : 1);
            }}
            title="切换导出与演出循环长度（1 小节 / 2 小节）"
            className="relative z-10 h-7 px-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[10.5px] font-black text-[#FFD426] shrink-0 cursor-pointer whitespace-nowrap"
          >
            {beatBars} 小节
          </button>
          <button
            onClick={() => {
              playSfx('click', 0.75);
              cycleScale();
            }}
            title={`调式锁定：${SCALE_META[scale].zhLabel}（点击切换）`}
            className="relative z-10 h-7 px-2.5 rounded-full bg-[#FBF9F4] border-[2px] border-[#17171C] text-[11px] font-black text-[#17171C] flex items-center gap-0.5 shrink-0 cursor-pointer hover:bg-[#FFD426] transition-colors whitespace-nowrap"
          >
            <span>{SCALE_META[scale].label}</span>
            <ChevronDown className="w-3 h-3 shrink-0" strokeWidth={3} />
          </button>
        </div>

        {/* Right: BPM + 摇摆 + 5 套东方市井预设 + 撤销/重做/随机/清空 */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-[40px] rounded-xl bg-[#FBF9F4] border-[2.5px] border-[#17171C] shadow-[2px_2px_0px_0px_#17171C] px-1 flex items-center gap-0.5">
            <button
              onClick={() => {
                playSfx('knobTick', 0.3);
                setBpm(bpm - 4);
              }}
              className="p-0.5 hover:bg-[#E7E1D3] rounded-md cursor-pointer"
              aria-label="降低速度"
            >
              <ChevronLeft className="w-3.5 h-3.5 fill-current" />
            </button>
            <div className="px-1.5 py-0.5 rounded-md bg-[#14151B] font-mono-hw text-[11px] font-black text-[#FBF9F4] whitespace-nowrap">
              {bpm} BPM
            </div>
            <button
              onClick={() => {
                playSfx('knobTick', 0.8);
                setBpm(bpm + 4);
              }}
              className="p-0.5 hover:bg-[#E7E1D3] rounded-md cursor-pointer"
              aria-label="提高速度"
            >
              <ChevronRight className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>

          <BrutalKnob
            value={swing / 0.6}
            onChange={(v) => setSwing(v * 0.6)}
            color="#FFD426"
            size={32}
            label="摇摆"
            title={`摇摆度：${Math.round(swing * 100)}%`}
          />

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              {(['MARKET', 'NIGHT', 'LOFI', 'RAIN', 'LION'] as BeatPresetId[]).map((pid) => {
                const isSel = activePreset === pid;
                return (
                  <button
                    key={pid}
                    onClick={() => handleLoadPreset(pid)}
                    title={BEAT_PRESETS[pid].zhTitle}
                    className={`brutal-pad px-2 py-0.5 rounded-md text-[10px] font-black whitespace-nowrap ${
                      isSel
                        ? 'bg-[#FFD426] text-[#17171C]'
                        : 'bg-[#FBF9F4] text-[#17171C] hover:bg-[#E7E1D3]'
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
                className="brutal-pad px-1.5 py-0.5 rounded-md bg-[#FBF9F4] disabled:opacity-40 text-[10px] font-black flex items-center gap-0.5 whitespace-nowrap"
              >
                <Undo2 className="w-2.5 h-2.5 shrink-0" strokeWidth={2.8} />
                <span>撤销</span>
              </button>
              <button
                onClick={() => {
                  playSfx('click', 0.65);
                  redoBeat();
                }}
                disabled={beatRedoLen === 0}
                title="重做 (Ctrl+Y)"
                className="brutal-pad px-1.5 py-0.5 rounded-md bg-[#FBF9F4] disabled:opacity-40 text-[10px] font-black flex items-center gap-0.5 whitespace-nowrap"
              >
                <Redo2 className="w-2.5 h-2.5 shrink-0" strokeWidth={2.8} />
                <span className="hidden xl:inline">重做</span>
              </button>
              <button
                onClick={() => {
                  playSfx('ratchet');
                  setActivePreset(null);
                  randomizeBeat();
                }}
                title="智能生成调式内随机街头律动"
                className="brutal-pad flex-1 px-2 py-0.5 rounded-md bg-[#FBF9F4] hover:bg-[#00D4AA] text-[10px] font-black flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <Shuffle className="w-2.5 h-2.5 shrink-0" strokeWidth={2.8} />
                <span>随机</span>
              </button>
              <button
                onClick={() => {
                  playSfx('click', 0.2);
                  setActivePreset(null);
                  clearBeat();
                }}
                title="清空全部打击垫（支持 Ctrl+Z 撤销）"
                className="brutal-pad flex-1 px-2 py-0.5 rounded-md bg-[#FBF9F4] hover:bg-[#FF5526] hover:text-white text-[10px] font-black flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <Trash2 className="w-2.5 h-2.5 shrink-0" strokeWidth={2.8} />
                <span>清空</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PINBALL QUANTIZE GHOST PREVIEW BANNER (When Active!) ================= */}
      {quantizePreview && (
        <section className="px-3.5 py-2 rounded-2xl bg-[#14151B] text-[#FBF9F4] border-[2.5px] border-[#00D4AA] shadow-[3px_3px_0px_#17171C] flex items-center justify-between gap-3 shrink-0 animate-card-pop">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-[#00D4AA] text-[#17171C] text-[10.5px] font-black shrink-0 whitespace-nowrap">
              量化预览
            </span>
            <span className="text-xs font-extrabold truncate">
              虚线发光格为弹珠录音量化预览（{quantizePreview.mappedCount} 步 · 原录音完整保留）
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => void holoAudio.playPinballRecording(quantizePreview.sourceEvents)}
              className="brutal-pad px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-black whitespace-nowrap"
            >
              ▶ 听原弹珠录音
            </button>
            <button
              onClick={() => {
                playSfx('cartridgeLock');
                applyPinballQuantize('merge');
              }}
              className="brutal-pad px-2.5 py-1 rounded-lg bg-[#00D4AA] text-[#17171C] text-[11px] font-black whitespace-nowrap"
            >
              合并至当前轨
            </button>
            <button
              onClick={() => {
                playSfx('cartridgeLock');
                applyPinballQuantize('replace');
              }}
              className="brutal-pad px-2.5 py-1 rounded-lg bg-[#FFD426] text-[#17171C] text-[11px] font-black whitespace-nowrap"
            >
              替换为量化轨
            </button>
            <button
              onClick={() => {
                playSfx('click', 0.3);
                applyPinballQuantize('cancel');
              }}
              className="brutal-pad px-2 py-1 rounded-lg bg-[#FF5526] text-white text-[11px] font-black whitespace-nowrap"
            >
              取消
            </button>
          </div>
        </section>
      )}

      {/* ================= 2. MAIN 4-TRACK SEQUENCER CHASSIS + HOLO MOTION OVERLAY ================= */}
      <section className="brutal-panel flex-1 flex flex-col px-3.5 py-2 min-h-0 overflow-hidden">
        {/* Header Bar with Remix Lineage + View Switches + Step Numbers */}
        <div
          className={`grid gap-3 items-center pb-1.5 shrink-0 ${
            beatStageMode ? 'grid-cols-[1fr]' : 'grid-cols-[194px_162px_1fr]'
          }`}
        >
          {!beatStageMode && (
            <div className="flex items-center justify-between pl-1">
              <span className="text-[11px] font-black text-[#626272] whitespace-nowrap">声卡卡槽</span>
              {beatRemixOrigin && (
                <span className="px-1.5 py-0.5 rounded bg-[#7C3AED] text-white text-[9.5px] font-bold whitespace-nowrap">
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
                title="开启/关闭音乐驱动的音符跳跃动画"
                className={`px-2 py-0.5 rounded-full border-[1.5px] border-[#17171C] text-[9.5px] font-black flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                  beatBounceMode ? 'bg-[#00D4AA] text-[#17171C]' : 'bg-[#EDE7D9] text-[#626272]'
                }`}
              >
                <Activity className="w-2.5 h-2.5 shrink-0" />
                <span>音符跳跃 {beatBounceMode ? '开' : '关'}</span>
              </button>
              <button
                onClick={() => {
                  playSfx('click', 0.7);
                  setBeatStageMode(!beatStageMode);
                }}
                title="切换动态演出宽屏视窗"
                className="px-2 py-0.5 rounded-full border-[1.5px] border-[#17171C] bg-[#FBF9F4] hover:bg-[#FFD426] text-[9.5px] font-black cursor-pointer whitespace-nowrap"
              >
                演出视图
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {beatStageMode && (
              <button
                onClick={() => setBeatStageMode(false)}
                className="brutal-pad px-2.5 py-0.5 rounded-full bg-[#FFD426] text-[10px] font-black shrink-0"
              >
                ← 返回标准编曲
              </button>
            )}
            <div className="flex-1 grid grid-cols-16 gap-1.5 px-1">
              {Array.from({ length: 16 }, (_, stepIdx) => {
                const isGroupStart = stepIdx % 4 === 0;
                const isHead = livePlayhead === stepIdx;
                const isBarActive =
                  isPlaying && livePlayhead >= 0 && Math.floor(livePlayhead / 4) === Math.floor(stepIdx / 4);
                return (
                  <div
                    key={stepIdx}
                    className={`relative flex flex-col items-center justify-center font-mono-hw text-[10.5px] font-black transition-all ${
                      isHead
                        ? 'text-[#FF5526] scale-115'
                        : isGroupStart
                          ? 'text-[#17171C]'
                          : 'text-[#626272]'
                    }`}
                  >
                    {isGroupStart && stepIdx > 0 && (
                      <span className="absolute -left-[4px] top-0.5 bottom-0.5 w-[1.5px] bg-[#17171C]/28" />
                    )}
                    <span
                      className={`w-1.5 h-1.5 rounded-full mb-0.5 transition-colors ${
                        isHead
                          ? 'bg-[#FF5526] shadow-[0_0_6px_#FF5526]'
                          : isGroupStart
                            ? isBarActive
                              ? 'bg-[#00D4AA]'
                              : 'bg-[#17171C]/35'
                            : 'bg-transparent'
                      }`}
                    />
                    <span>{stepIdx + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4 Horizontal Track Rows + Live Playhead + Holo Motion Parabolic Bouncing Canvas */}
        <div ref={matrixGridRef} className="flex-1 grid grid-rows-4 gap-2 min-h-0 relative">
          {/* Continuous Vertical Neon Playhead Column (Only when Playing!) */}
          {livePlayhead >= 0 && livePlayhead < 16 && (
            <div
              className={`pointer-events-none absolute inset-0 z-15 grid gap-3 px-2.5 ${
                beatStageMode ? 'grid-cols-[1fr]' : 'grid-cols-[194px_162px_1fr]'
              }`}
            >
              {!beatStageMode && <div />}
              {!beatStageMode && <div />}
              <div className="grid grid-cols-16 gap-1.5 px-1 h-full">
                {Array.from({ length: 16 }, (_, idx) => (
                  <div
                    key={idx}
                    className={
                      idx === livePlayhead
                        ? 'h-full -my-0.5 rounded-xl border-[2.5px] border-[#FFD426] bg-[#FFD426]/10 shadow-[0_0_16px_rgba(255,212,38,0.6),inset_0_0_8px_rgba(255,212,38,0.22)]'
                        : ''
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* HOLO MOTION Bouncing Sound-Life Canvas Overlay (Pointer-Events-None, Zero Reflow!) */}
          <canvas
            ref={bounceCanvasRef}
            className="pointer-events-none absolute inset-0 w-full h-full z-25"
          />

          {tracks.map((track, trackIdx) => {
            const card = getCardById(track.cardId);
            const catMeta = CATEGORY_META[track.category];
            const rarMeta = RARITY_META[card.rarity];
            const isMuted = track.mute || (anySolo && !track.solo);
            const isRowFiring = !isMuted && livePlayhead >= 0 && track.steps[livePlayhead];
            const ghostRow = quantizePreview?.ghostSteps[trackIdx];

            return (
              <div
                key={track.category}
                className={`grid gap-3 items-center rounded-2xl border-[2px] px-2.5 py-1.5 transition-colors ${
                  beatStageMode ? 'grid-cols-[1fr]' : 'grid-cols-[194px_162px_1fr]'
                } ${
                  isMuted
                    ? 'border-[#17171C]/35 bg-[#F3EFE6]/70 opacity-70'
                    : 'border-[#17171C]/85 bg-[#FBF9F4] shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]'
                }`}
              >
                {/* LEFT: Physical Cartridge Slot + Eject */}
                {!beatStageMode && (
                  <div className="flex items-stretch gap-1.5 h-full max-h-[76px] min-h-[60px]">
                    <button
                      onClick={() => void holoAudio.previewCard(card.id)}
                      title={`点击试听：${card.zhTitle}（${catMeta.zhLabel}）`}
                      className={`flex-1 rounded-xl bg-[#14151B] border-[2.5px] border-[#17171C] p-[3px] flex flex-col overflow-hidden cursor-pointer group transition-transform duration-100 ${
                        isRowFiring ? 'scale-[1.02] ring-2 ring-[#FFD426]' : 'hover:brightness-105'
                      }`}
                    >
                      <div
                        className="border-b-[1.5px] border-[#17171C] rounded-t-[6px] px-2 py-[2px] flex items-center justify-between"
                        style={{ backgroundColor: catMeta.color, color: catMeta.textColor }}
                        title={catMeta.zhLabel}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full border border-[#17171C]/50 transition-all ${
                            isRowFiring
                              ? 'bg-[#FFFFFF] scale-125 shadow-[0_0_6px_#FFFFFF]'
                              : 'bg-[#17171C]/35'
                          }`}
                        />
                        <span className="text-[10.5px] font-black tracking-wide leading-none whitespace-nowrap">
                          {catMeta.label}
                        </span>
                        <span className="font-mono-hw text-[9px] font-black opacity-85 leading-none">
                          {card.code}
                        </span>
                      </div>
                      <div className="relative flex-1 rounded-b-[6px] overflow-hidden holo-thumb-sheen flex items-center bg-[#1E1F28]">
                        <div className="w-12 h-full shrink-0 overflow-hidden border-r-[1.5px] border-[#17171C]">
                          <CardArtwork artId={card.artId} />
                        </div>
                        <div className="flex-1 px-2 py-0.5 flex flex-col justify-center gap-0.5 h-full text-left min-w-0">
                          <div className="flex items-center gap-1">
                            <span
                              className="px-1 py-[0.5px] rounded text-[8.5px] font-black border border-[#17171C] shrink-0"
                              style={{ backgroundColor: rarMeta.bg, color: rarMeta.text }}
                            >
                              {rarMeta.label}
                            </span>
                          </div>
                          <div className="text-[11.5px] font-black text-[#FBF9F4] truncate leading-tight">
                            {card.zhTitle}
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        playSfx('click', 0.7);
                        setSwapTrackIdx(trackIdx);
                      }}
                      title="弹出更换此轨道插槽声卡"
                      className="brutal-pad w-7 rounded-xl bg-[#FBF9F4] hover:bg-[#FFD426] flex flex-col items-center justify-center shrink-0"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-[#17171C]">
                        <polygon points="8,3 14,10 2,10" />
                        <rect x="2" y="12" width="12" height="2" rx="0.5" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* MIDDLE: Compact Channel Mixer */}
                {!beatStageMode && (
                  <div className="flex items-center gap-2 px-1.5 border-x-[1.5px] border-[#17171C]/12 h-full">
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => {
                          playSfx('click', 0.4);
                          toggleTrackMute(trackIdx);
                        }}
                        title="静音"
                        className={`w-6.5 h-6 rounded-md border-[2px] border-[#17171C] text-[10.5px] font-black cursor-pointer transition-colors ${
                          track.mute
                            ? 'bg-[#FF5526] text-white'
                            : 'bg-[#FBF9F4] text-[#17171C] hover:bg-[#E7E1D3]'
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
                        className={`w-6.5 h-6 rounded-md border-[2px] border-[#17171C] text-[10.5px] font-black cursor-pointer transition-colors ${
                          track.solo
                            ? 'bg-[#FFD426] text-[#17171C]'
                            : 'bg-[#FBF9F4] text-[#17171C] hover:bg-[#E7E1D3]'
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
                      title="上下拖拽或滚轮调节滤波明亮度与音高"
                    />

                    <BrutalSlider
                      value={track.volume}
                      onChange={(val) => setTrackVolume(trackIdx, val)}
                      color={catMeta.color}
                      label="音量"
                      height={12}
                      className="flex-1 min-w-[50px]"
                    />
                  </div>
                )}

                {/* RIGHT: 16-Step Tactile MPC Pad Matrix (Supports Accent Velocity + Ghost Quantize Preview!) */}
                <div className="grid grid-cols-16 gap-1.5 h-full items-center px-1 relative">
                  {track.steps.map((isOn, stepIdx) => {
                    const isHead = livePlayhead === stepIdx;
                    const isAccented = Boolean(track.accents?.[stepIdx]) && isOn;
                    const isGhost = Boolean(ghostRow?.[stepIdx]) && !isOn;
                    const isBeatB = Math.floor(stepIdx / 4) % 2 === 1;
                    const isGroupStart = stepIdx % 4 === 0 && stepIdx > 0;
                    const offBg = isBeatB ? '#DED7C7' : '#ECE6D8';
                    return (
                      <button
                        key={stepIdx}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          pushBeatUndo();
                          toggleStepAccent(trackIdx, stepIdx);
                          void holoAudio.previewCard(card.id, {
                            stepIndex: stepIdx,
                            tone: track.tone,
                            velocity: 0.98,
                          });
                        }}
                        onPointerDown={(e) => {
                          if (e.button === 2) return;
                          e.preventDefault();
                          pushBeatUndo();
                          if (e.shiftKey) {
                            toggleStepAccent(trackIdx, stepIdx);
                            void holoAudio.previewCard(card.id, {
                              stepIndex: stepIdx,
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
                          toggleStep(trackIdx, stepIdx, nextVal);
                          if (nextVal) {
                            void holoAudio.previewCard(card.id, {
                              stepIndex: stepIdx,
                              tone: track.tone,
                              velocity: 0.72,
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
                            toggleStep(trackIdx, stepIdx, paintModeRef.current.value);
                          }
                        }}
                        style={{
                          backgroundColor: isOn ? catMeta.color : offBg,
                          boxShadow:
                            isOn && isHead
                              ? `0 0 14px ${catMeta.color}, 2px 2px 0px #17171C`
                              : undefined,
                        }}
                        title="点击开关 · 拖拽涂抹 · 右键/Shift 切换重音力度"
                        className={`relative h-[74%] min-h-[42px] max-h-[76px] w-full rounded-[10px] brutal-pad ${
                          isHead && isOn
                            ? 'animate-pad-hit z-10 ring-2 ring-white'
                            : isHead
                              ? 'brightness-106 z-10'
                              : ''
                        } ${isAccented ? 'ring-2 ring-[#FFD426]' : ''} ${
                          isGhost ? 'border-dashed !border-[#00D4AA] ring-2 ring-[#00D4AA]/60' : ''
                        } ${isGroupStart ? 'ml-[1px]' : ''}`}
                        aria-label={`${track.category} step ${stepIdx + 1}`}
                      >
                        {isOn && (
                          <>
                            <span className="absolute inset-x-1.5 top-1 h-1 rounded-full bg-white/40 pointer-events-none" />
                            <span
                              className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full pointer-events-none ${
                                isAccented
                                  ? 'w-2.5 h-1 bg-[#FFD426] shadow-[0_0_5px_#FFD426]'
                                  : 'w-2 h-[3px] bg-[#17171C]/35'
                              }`}
                            />
                          </>
                        )}
                        {isGhost && (
                          <span
                            className="absolute inset-1.5 rounded-[6px] opacity-45 pointer-events-none animate-pulse"
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

      {/* ================= 3. BOTTOM LIVE FX + PERFORM IN PINBALL + MINT BAR ================= */}
      <section className="flex items-center gap-2.5 shrink-0">
        <div className="flex-1 grid grid-cols-3 gap-2.5">
          {[
            { key: 'bitcrush' as const, label: '像素碎音', bg: '#7C3AED', text: '#FFFFFF' },
            { key: 'echo' as const, label: '街巷回声', bg: '#FF5526', text: '#FFFFFF' },
            { key: 'stutter' as const, label: '切拍重复', bg: '#00D4AA', text: '#17171C' },
          ].map((fx) => {
            const active = liveFx[fx.key];
            return (
              <button
                key={fx.key}
                onClick={() => {
                  playSfx('click', active ? 0.35 : 0.9);
                  setLiveFx(fx.key, !active);
                }}
                title={`${fx.label}（点击开关叠加实时特效，导出 WAV 时同步保留）`}
                style={{ backgroundColor: fx.bg, color: fx.text }}
                className={`brutal-btn-lg h-[46px] px-3.5 rounded-2xl flex items-center justify-between whitespace-nowrap ${
                  active ? 'brutal-btn-pressed ring-2 ring-[#FFD426]' : ''
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full border-[2px] border-[#17171C] transition-all shrink-0 ${
                    active ? 'bg-[#A3E635] shadow-[0_0_10px_#A3E635]' : 'bg-[#FBF9F4]/70'
                  }`}
                />
                <span className="text-[14.5px] zh-display">{fx.label}</span>
                <span className="text-[10.5px] font-black opacity-85">
                  {active ? '开' : '关'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="h-8 w-[1.5px] bg-[#17171C]/20 shrink-0" />

        <button
          onClick={() => {
            playSfx('portalWarp');
            holoAudio.stopTransport();
            performBeatInPinball();
          }}
          title="将当前编曲冻结为确定性音乐事件，送入 03 弹珠剧场观看音画同步演出"
          className="brutal-btn-lg h-[46px] px-4 rounded-2xl bg-[#14151B] text-[#00D4AA] text-[13.5px] zh-display flex items-center gap-1.5 shrink-0 whitespace-nowrap"
        >
          <Disc3 className="w-4 h-4 shrink-0" />
          <span>进入弹珠剧场</span>
        </button>

        <button
          onClick={() => {
            playSfx('mintStamp');
            sendBeatToForge();
          }}
          className="brutal-btn-lg h-[46px] px-5 rounded-2xl bg-[#FFD426] text-[#17171C] text-[14px] zh-display flex items-center gap-1.5 shrink-0 whitespace-nowrap"
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
            <div className="px-4 py-3 bg-[#FFD426] border-b-[2.5px] border-[#17171C] flex items-center justify-between">
              <div>
                <h3 className="text-base zh-display text-[#17171C]">
                  更换「{CATEGORY_META[tracks[swapTrackIdx].category].zhLabel}」轨道声卡
                </h3>
                <p className="text-xs font-bold text-[#17171C]/75">
                  选择已收集的市井声卡插入卡槽（支持跨轨混搭实验）
                </p>
              </div>
              <button
                onClick={() => setSwapTrackIdx(null)}
                aria-label="关闭换卡窗口"
                className="brutal-btn w-8 h-8 rounded-lg bg-[#FBF9F4] flex items-center justify-center"
              >
                <X className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto holo-scroll grid grid-cols-2 gap-3 bg-[#F3EFE6]">
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
                        void holoAudio.previewCard(c.id);
                        setSwapTrackIdx(null);
                      }}
                      className={`p-2 rounded-xl border-[2.5px] border-[#17171C] flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFD426] shadow-[3px_3px_0px_0px_#17171C]'
                          : 'bg-[#FBF9F4] hover:bg-[#E7E1D3] shadow-[2px_2px_0px_0px_#17171C]'
                      }`}
                    >
                      <div className="w-12 h-14 rounded-lg border-2 border-[#17171C] overflow-hidden holo-thumb-sheen shrink-0">
                        <CardArtwork artId={c.artId} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="px-1.5 py-0.5 rounded text-[9.5px] font-black border border-[#17171C]"
                            style={{ backgroundColor: cat.color, color: cat.textColor }}
                          >
                            {cat.label}
                          </span>
                          <span className="font-mono-hw text-[10px] font-black">{c.code}</span>
                        </div>
                        <div className="text-[12.5px] font-black truncate mt-1 text-[#17171C]">
                          {c.zhTitle}
                        </div>
                        <div className="text-[10px] font-bold text-[#626272] truncate">
                          {cat.zhLabel} · 推荐 {c.recommendedBpm} BPM
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
