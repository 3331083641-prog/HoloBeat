import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Pause, Play, Shuffle, Square, Trash2, X } from 'lucide-react';
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
import { BEAT_PRESETS, useHoloStore } from '../store/useHoloStore';
import type { BeatPresetId } from '../types/holo';

export const BeatDeckPage: React.FC = () => {
  const isPlaying = useHoloStore((s) => s.isPlaying);
  const bpm = useHoloStore((s) => s.bpm);
  const swing = useHoloStore((s) => s.swing);
  const scale = useHoloStore((s) => s.scale);
  const tracks = useHoloStore((s) => s.tracks);
  const liveFx = useHoloStore((s) => s.liveFx);
  const collection = useHoloStore((s) => s.collection);

  const setBpm = useHoloStore((s) => s.setBpm);
  const setSwing = useHoloStore((s) => s.setSwing);
  const cycleScale = useHoloStore((s) => s.cycleScale);
  const toggleStep = useHoloStore((s) => s.toggleStep);
  const setTrackCard = useHoloStore((s) => s.setTrackCard);
  const setTrackVolume = useHoloStore((s) => s.setTrackVolume);
  const setTrackTone = useHoloStore((s) => s.setTrackTone);
  const toggleTrackMute = useHoloStore((s) => s.toggleTrackMute);
  const toggleTrackSolo = useHoloStore((s) => s.toggleTrackSolo);
  const applyBeatPreset = useHoloStore((s) => s.applyBeatPreset);
  const randomizeBeat = useHoloStore((s) => s.randomizeBeat);
  const clearBeat = useHoloStore((s) => s.clearBeat);
  const setLiveFx = useHoloStore((s) => s.setLiveFx);
  const sendBeatToForge = useHoloStore((s) => s.sendBeatToForge);
  const pushToast = useHoloStore((s) => s.pushToast);

  const playSfx = useHoloSfx();
  const [activeStep, setActiveStep] = useState<number>(() => holoAudio.getCurrentStep());
  const [swapTrackIdx, setSwapTrackIdx] = useState<number | null>(null);
  const [activePreset, setActivePreset] = useState<BeatPresetId | null>('MARKET');

  const oledCanvasRef = useRef<HTMLCanvasElement>(null);
  const paintModeRef = useRef<{ painting: boolean; value: boolean; trackIdx: number }>({
    painting: false,
    value: true,
    trackIdx: -1,
  });

  // Subscribe to Tone.Draw synchronized step callback
  useEffect(() => {
    const unsub = holoAudio.subscribeStep((step) => {
      setActiveStep(step);
    });
    return unsub;
  }, []);

  // Spacebar Play/Pause shortcut on Beat Deck
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        void holoAudio.togglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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

  // 60fps Master OLED Spectrum + Neon Oscilloscope Visualizer
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

          // Left half: Crisp Retina Rainbow FFT Spectrum Bars
          const spectrumW = Math.min(w * 0.44, 240);
          const barCount = barColors.length;
          const gap = 3.5;
          const bw = (spectrumW - 14 - gap * (barCount - 1)) / barCount;

          for (let i = 0; i < barCount; i++) {
            const db = fft[i + 1] ?? -100;
            const norm = Math.min(1, Math.max(0, (db + 88) / 68));
            const idle = playing
              ? 0.22 + Math.abs(Math.sin(t * 0.008 + i * 0.7)) * 0.55
              : 0.16 + Math.sin(((i + 0.5) / barCount) * Math.PI) * (0.46 + Math.sin(t * 0.003 + i) * 0.12);
            const lvl = Math.max(norm, idle * (playing ? 0.85 : 0.72));
            const bh = Math.max(4, lvl * (h - 12));
            const x = 8 + i * (bw + gap);
            ctx.fillStyle = barColors[i];
            ctx.beginPath();
            ctx.roundRect(x, h - 6 - bh, bw, bh, 2);
            ctx.fill();
          }

          // Vertical divider inside OLED
          const midX = spectrumW + 6;
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(midX, 8);
          ctx.lineTo(midX, h - 8);
          ctx.stroke();

          // Right half: Crisp Retina Glowing Cyan -> Magenta Oscilloscope Wave
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
              (playing ? 0.36 : 0.28);
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

  // Only light up the moving playhead when transport is active!
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
    <div className="w-full h-full p-3.5 flex flex-col gap-3 overflow-hidden">
      {/* ================= 1. TOP TRANSPORT & MASTER OLED DECK ================= */}
      <section className="brutal-panel px-3 py-2 flex items-center justify-between gap-2.5 shrink-0">
        {/* Left: PLAY / STOP / REC CARD */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              playSfx('click', 0.8);
              void holoAudio.togglePlay();
            }}
            title="播放 / 暂停（快捷键 Space）"
            className={`brutal-btn h-[48px] px-4 rounded-xl flex items-center gap-1.5 text-[14px] font-black tracking-wide ${
              isPlaying
                ? 'bg-[#FFD426] text-[#17171C] ring-2 ring-[#17171C]'
                : 'bg-[#00D4AA] text-[#17171C]'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          <button
            onClick={() => {
              playSfx('click', 0.35);
              holoAudio.stopTransport();
            }}
            className="brutal-btn h-[48px] px-3 rounded-xl bg-[#FBF9F4] text-[#17171C] flex items-center gap-1.5 text-[14px] font-black tracking-wide"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>STOP</span>
          </button>

          <button
            onClick={() => {
              playSfx('mintStamp');
              sendBeatToForge();
            }}
            title="灌录当前节拍快照送入 04 闪卡铸造屋"
            className="brutal-btn h-[48px] px-3 rounded-xl bg-[#FF5526] text-[#17171C] flex items-center gap-1.5 text-[12px] font-black leading-tight text-left"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-[#FBF9F4] border-[2.5px] border-[#17171C] shrink-0" />
            <span>
              REC
              <br />
              CARD
            </span>
          </button>
        </div>

        {/* Center: Wide Deep-Obsidian OLED Visualizer + Scale Lock Pill */}
        <div className="relative oled-scanlines flex-1 h-[52px] rounded-2xl bg-[#14151B] border-[2.5px] border-[#17171C] shadow-[inset_0_3px_10px_rgba(0,0,0,0.65)] px-2 flex items-center gap-2 min-w-[180px] overflow-hidden">
          <canvas
            ref={oledCanvasRef}
            width={360}
            height={48}
            className="flex-1 h-full min-w-0 block"
          />
          <button
            onClick={() => {
              playSfx('click', 0.75);
              cycleScale();
            }}
            title={`调式锁定：${SCALE_META[scale].zhLabel}（点击切换五声 / 小调 / 爵士）`}
            className="relative z-10 h-8 px-2.5 rounded-full bg-[#FBF9F4] border-[2px] border-[#17171C] font-mono-hw text-[11px] font-black text-[#17171C] flex items-center gap-1 shrink-0 cursor-pointer hover:bg-[#FFD426] transition-colors"
          >
            <span>{SCALE_META[scale].label}</span>
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
        </div>

        {/* Right: BPM Stepper + SWING Calibrated Knob + 3 Demo Presets + RAND/CLEAR */}
        <div className="flex items-center gap-2 shrink-0">
          {/* BPM Stepper Pill */}
          <div className="h-[42px] rounded-xl bg-[#FBF9F4] border-[2.5px] border-[#17171C] shadow-[2px_2px_0px_0px_#17171C] px-1 flex items-center gap-0.5">
            <button
              onClick={() => {
                playSfx('knobTick', 0.3);
                setBpm(bpm - 4);
              }}
              className="p-1 hover:bg-[#E7E1D3] rounded-lg cursor-pointer"
              aria-label="decrease bpm"
            >
              <ChevronLeft className="w-3.5 h-3.5 fill-current" />
            </button>
            <div className="px-2 py-1 rounded-lg bg-[#14151B] font-mono-hw text-[11.5px] font-black text-[#FBF9F4] whitespace-nowrap">
              {bpm} BPM
            </div>
            <button
              onClick={() => {
                playSfx('knobTick', 0.8);
                setBpm(bpm + 4);
              }}
              className="p-1 hover:bg-[#E7E1D3] rounded-lg cursor-pointer"
              aria-label="increase bpm"
            >
              <ChevronRight className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>

          {/* SWING Calibrated Rotary Knob */}
          <BrutalKnob
            value={swing / 0.6}
            onChange={(v) => setSwing(v * 0.6)}
            color="#FFD426"
            size={34}
            label="SWING"
            title={`摇摆度 Swing: ${Math.round(swing * 100)}%（上下拖拽或滚轮调节）`}
          />

          {/* Compact Curated Presets + Tools */}
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-3 gap-1">
              {(['MARKET', 'NIGHT', 'LOFI'] as BeatPresetId[]).map((pid) => {
                const isSel = activePreset === pid;
                return (
                  <button
                    key={pid}
                    onClick={() => handleLoadPreset(pid)}
                    title={BEAT_PRESETS[pid].zhTitle}
                    className={`brutal-pad px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide whitespace-nowrap ${
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
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => {
                  playSfx('ratchet');
                  setActivePreset(null);
                  randomizeBeat();
                }}
                title="一键随机生成街头律动"
                className="brutal-pad px-2 py-0.5 rounded-md bg-[#FBF9F4] hover:bg-[#00D4AA] text-[10px] font-black tracking-wide flex items-center justify-center gap-1"
              >
                <Shuffle className="w-2.5 h-2.5" strokeWidth={2.8} />
                <span>RAND</span>
              </button>
              <button
                onClick={() => {
                  playSfx('click', 0.2);
                  setActivePreset(null);
                  clearBeat();
                }}
                title="清空全部打击垫"
                className="brutal-pad px-2 py-0.5 rounded-md bg-[#FBF9F4] hover:bg-[#FF5526] hover:text-white text-[10px] font-black tracking-wide flex items-center justify-center gap-1"
              >
                <Trash2 className="w-2.5 h-2.5" strokeWidth={2.8} />
                <span>CLEAR</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 2. MAIN 4-TRACK SEQUENCER CHASSIS ================= */}
      <section className="brutal-panel flex-1 flex flex-col px-3.5 py-2.5 min-h-0 overflow-hidden">
        {/* Step Column Numbers 1..16 + Live 4-Beat Bar LEDs */}
        <div className="grid grid-cols-[194px_162px_1fr] gap-3 items-center pb-1.5 shrink-0">
          <div className="flex items-center justify-between pl-1">
            <span className="hw-silkscreen">CARTRIDGE SLOTS</span>
            <span className="hw-silkscreen !text-[8px] opacity-70">UNIT 02</span>
          </div>
          <div className="hw-silkscreen text-center">CHANNEL MIXER</div>
          <div className="grid grid-cols-16 gap-1.5 px-1">
            {Array.from({ length: 16 }, (_, stepIdx) => {
              const isGroupStart = stepIdx % 4 === 0;
              const isHead = livePlayhead === stepIdx;
              const isBarActive = isPlaying && livePlayhead >= 0 && Math.floor(livePlayhead / 4) === Math.floor(stepIdx / 4);
              return (
                <div
                  key={stepIdx}
                  className={`relative flex flex-col items-center justify-center font-mono-hw text-[11px] font-black transition-all ${
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

        {/* 4 Horizontal Track Rows + Continuous Vertical Glowing Playhead Column (Only When Playing!) */}
        <div className="flex-1 grid grid-rows-4 gap-2 min-h-0 relative">
          {livePlayhead >= 0 && livePlayhead < 16 && (
            <div className="pointer-events-none absolute inset-0 z-20 grid grid-cols-[194px_162px_1fr] gap-3 px-2.5">
              <div />
              <div />
              <div className="grid grid-cols-16 gap-1.5 px-1 h-full">
                {Array.from({ length: 16 }, (_, idx) => (
                  <div
                    key={idx}
                    className={
                      idx === livePlayhead
                        ? 'h-full -my-0.5 rounded-xl border-[2.5px] border-[#FFD426] bg-[#FFD426]/12 shadow-[0_0_16px_rgba(255,212,38,0.65),inset_0_0_8px_rgba(255,212,38,0.28)]'
                        : ''
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {tracks.map((track, trackIdx) => {
            const card = getCardById(track.cardId);
            const catMeta = CATEGORY_META[track.category];
            const rarMeta = RARITY_META[card.rarity];
            const isMuted = track.mute || (anySolo && !track.solo);
            const isRowFiring = !isMuted && livePlayhead >= 0 && track.steps[livePlayhead];

            return (
              <div
                key={track.category}
                className={`grid grid-cols-[194px_162px_1fr] gap-3 items-center rounded-2xl border-[2px] px-2.5 py-1.5 transition-colors ${
                  isMuted
                    ? 'border-[#17171C]/35 bg-[#F3EFE6]/70 opacity-72'
                    : 'border-[#17171C]/85 bg-[#FBF9F4] shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]'
                }`}
              >
                {/* LEFT: Physical Cartridge Sound-Card Slot + Eject Button */}
                <div className="flex items-stretch gap-1.5 h-full max-h-[76px] min-h-[62px]">
                  <button
                    onClick={() => void holoAudio.previewCard(card.id)}
                    title={`点击试听：${card.title}（${card.zhTitle}）`}
                    className={`flex-1 rounded-xl bg-[#14151B] border-[2.5px] border-[#17171C] p-[3px] flex flex-col overflow-hidden cursor-pointer group transition-transform duration-100 ${
                      isRowFiring ? 'scale-[1.02] ring-2 ring-[#FFD426]' : 'hover:brightness-105'
                    }`}
                  >
                    {/* Hardware Category Strip + Live Activity LED */}
                    <div
                      className="border-b-[1.5px] border-[#17171C] rounded-t-[6px] px-2 py-[2px] flex items-center justify-between"
                      style={{ backgroundColor: catMeta.color, color: catMeta.textColor }}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full border border-[#17171C]/50 transition-all ${
                          isRowFiring
                            ? 'bg-[#FFFFFF] scale-125 shadow-[0_0_6px_#FFFFFF]'
                            : 'bg-[#17171C]/35'
                        }`}
                      />
                      <span className="text-[10.5px] font-black tracking-wider leading-none">
                        {track.category}
                      </span>
                      <span className="font-mono-hw text-[9px] font-black opacity-85 leading-none">
                        {card.code}
                      </span>
                    </div>

                    {/* Inserted Miniature Holographic Card */}
                    <div className="relative flex-1 rounded-b-[6px] overflow-hidden holo-thumb-sheen flex items-center bg-[#1E1F28]">
                      <div className="w-12 h-full shrink-0 overflow-hidden border-r-[1.5px] border-[#17171C]">
                        <CardArtwork artId={card.artId} />
                      </div>
                      <div className="flex-1 px-2 py-0.5 flex flex-col justify-center gap-0.5 h-full text-left min-w-0">
                        <div className="flex items-center gap-1">
                          <span
                            className="px-1 py-[0.5px] rounded text-[8.5px] font-black border border-[#17171C]"
                            style={{ backgroundColor: rarMeta.bg, color: rarMeta.text }}
                          >
                            {rarMeta.label}
                          </span>
                          <span className="text-[9px] font-bold text-white/60 truncate">
                            {card.zhTitle}
                          </span>
                        </div>
                        <div className="text-[12px] font-black italic tracking-tight text-[#FBF9F4] truncate leading-none">
                          {card.shortTitle}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Eject / Swap Cartridge Button */}
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

                {/* MIDDLE: Compact Channel Mixer (M/S + Calibrated TONE Knob + Ridged VOL Fader) */}
                <div className="flex items-center gap-2 px-1.5 border-x-[1.5px] border-[#17171C]/12 h-full">
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => {
                        playSfx('click', 0.4);
                        toggleTrackMute(trackIdx);
                      }}
                      title="静音该轨 (Mute)"
                      className={`w-6.5 h-6 rounded-md border-[2px] border-[#17171C] font-mono-hw text-[10.5px] font-black cursor-pointer transition-colors ${
                        track.mute
                          ? 'bg-[#FF5526] text-white'
                          : 'bg-[#FBF9F4] text-[#17171C] hover:bg-[#E7E1D3]'
                      }`}
                    >
                      M
                    </button>
                    <button
                      onClick={() => {
                        playSfx('click', 0.7);
                        toggleTrackSolo(trackIdx);
                      }}
                      title="独奏该轨 (Solo)"
                      className={`w-6.5 h-6 rounded-md border-[2px] border-[#17171C] font-mono-hw text-[10.5px] font-black cursor-pointer transition-colors ${
                        track.solo
                          ? 'bg-[#FFD426] text-[#17171C]'
                          : 'bg-[#FBF9F4] text-[#17171C] hover:bg-[#E7E1D3]'
                      }`}
                    >
                      S
                    </button>
                  </div>

                  <BrutalKnob
                    value={track.tone}
                    onChange={(val) => setTrackTone(trackIdx, val)}
                    color={catMeta.color}
                    size={32}
                    label="TONE"
                    title="上下拖拽或滚轮调节滤波明亮度与音高"
                  />

                  <BrutalSlider
                    value={track.volume}
                    onChange={(val) => setTrackVolume(trackIdx, val)}
                    color={catMeta.color}
                    label="VOL"
                    height={12}
                    className="flex-1 min-w-[50px]"
                  />
                </div>

                {/* RIGHT: 16-Step Tactile MPC Pad Matrix (4-Beat Alternating Grouping + Hit Recoil!) */}
                <div className="grid grid-cols-16 gap-1.5 h-full items-center px-1 relative">
                  {track.steps.map((isOn, stepIdx) => {
                    const isHead = livePlayhead === stepIdx;
                    const isBeatB = Math.floor(stepIdx / 4) % 2 === 1;
                    const isGroupStart = stepIdx % 4 === 0 && stepIdx > 0;
                    const offBg = isBeatB ? '#DED7C7' : '#ECE6D8';
                    return (
                      <button
                        key={stepIdx}
                        onPointerDown={(e) => {
                          e.preventDefault();
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
                              velocity: 0.68,
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
                        className={`relative h-[74%] min-h-[44px] max-h-[78px] w-full rounded-[10px] brutal-pad ${
                          isHead && isOn
                            ? 'animate-pad-hit z-10 ring-2 ring-white'
                            : isHead
                              ? 'brightness-106 z-10'
                              : ''
                        } ${isGroupStart ? 'ml-[1px]' : ''}`}
                        aria-label={`${track.category} step ${stepIdx + 1}`}
                      >
                        {/* Tactile Hardware Pad Inner Specular Ridge & Mini LED */}
                        {isOn && (
                          <>
                            <span className="absolute inset-x-1.5 top-1 h-1 rounded-full bg-white/40 pointer-events-none" />
                            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-[3px] rounded-full bg-[#17171C]/35 pointer-events-none" />
                          </>
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

      {/* ================= 3. BOTTOM LIVE FX DECK BAR ================= */}
      <section className="flex items-center gap-3 shrink-0">
        <div className="flex-1 grid grid-cols-3 gap-3">
          {[
            { key: 'bitcrush' as const, label: 'BITCRUSH', zh: '像素碎音', bg: '#7C3AED', text: '#FFFFFF' },
            { key: 'echo' as const, label: 'STREET ECHO', zh: '弄堂回声', bg: '#FF5526', text: '#FFFFFF' },
            { key: 'stutter' as const, label: 'STUTTER', zh: '鬼畜切拍', bg: '#00D4AA', text: '#17171C' },
          ].map((fx) => {
            const active = liveFx[fx.key];
            return (
              <button
                key={fx.key}
                onClick={() => {
                  playSfx('click', active ? 0.35 : 0.9);
                  setLiveFx(fx.key, !active);
                }}
                title={`${fx.zh}（点击开关叠加 DJ 现场特效）`}
                style={{ backgroundColor: fx.bg, color: fx.text }}
                className={`brutal-btn-lg h-[48px] px-4 rounded-2xl flex items-center justify-between ${
                  active ? 'brutal-btn-pressed ring-2 ring-[#FFD426]' : ''
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full border-[2px] border-[#17171C] transition-all ${
                    active
                      ? 'bg-[#A3E635] shadow-[0_0_10px_#A3E635]'
                      : 'bg-[#FBF9F4]/70'
                  }`}
                />
                <span className="text-[15px] font-black tracking-wider uppercase">{fx.label}</span>
                <span className="font-mono-hw text-[10px] font-bold opacity-85 hidden sm:inline">
                  {active ? 'ACTIVE' : fx.zh}
                </span>
              </button>
            );
          })}
        </div>

        <div className="h-8 w-[1.5px] bg-[#17171C]/20 shrink-0" />

        <button
          onClick={() => {
            playSfx('mintStamp');
            sendBeatToForge();
          }}
          className="brutal-btn-lg h-[48px] px-6 rounded-2xl bg-[#FFD426] text-[#17171C] text-[15px] font-black tracking-wide uppercase flex items-center gap-2 shrink-0"
        >
          <span>MINT THIS BEAT</span>
          <span className="text-lg leading-none">→</span>
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
                <h3 className="text-base font-black uppercase text-[#17171C]">
                  SWAP CARTRIDGE · 更换 {tracks[swapTrackIdx].category} 卡槽声卡
                </h3>
                <p className="text-xs font-bold text-[#17171C]/75">
                  选择已收集的市井声卡插入卡槽（支持跨轨混搭实验！）
                </p>
              </div>
              <button
                onClick={() => setSwapTrackIdx(null)}
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
                            className="px-1.5 py-0.5 rounded text-[9px] font-black border border-[#17171C]"
                            style={{ backgroundColor: cat.color, color: cat.textColor }}
                          >
                            {cat.label}
                          </span>
                          <span className="font-mono-hw text-[10px] font-black">{c.code}</span>
                        </div>
                        <div className="text-xs font-black truncate mt-1">{c.title}</div>
                        <div className="text-[10px] font-bold text-[#626272] truncate">
                          {c.zhTitle}
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
