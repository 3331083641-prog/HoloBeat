import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Play, Square, X } from 'lucide-react';
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
import { useHoloStore } from '../store/useHoloStore';

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

  // Spacebar Play/Stop shortcut on Beat Deck
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

  // Release pad drag-painting globally
  useEffect(() => {
    const onUp = () => {
      paintModeRef.current.painting = false;
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, []);

  // Sync audio parameters whenever store changes
  useEffect(() => {
    holoAudio.syncFromStore();
  }, [bpm, swing, tracks, liveFx]);

  // 60fps Master OLED Spectrum + Neon Waveform Visualizer (1:1 Mockup 2!)
  useEffect(() => {
    let raf = 0;
    const barColors = [
      '#00D4AA',
      '#00D4AA',
      '#38BDF8',
      '#38BDF8',
      '#7C3AED',
      '#A855F7',
      '#FF3D9A',
      '#FF3D9A',
      '#FF5C2B',
      '#FF5C2B',
      '#FFD60A',
      '#FFD60A',
    ];

    const render = (t: number) => {
      const canvas = oledCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.fillStyle = '#181820';
          ctx.fillRect(0, 0, w, h);

          const fft = holoAudio.getFftData();
          const wave = holoAudio.getWaveformData();
          const playing = useHoloStore.getState().isPlaying;

          // Left half: 12 Rainbow FFT Spectrum Bars
          const spectrumW = w * 0.44;
          const barCount = barColors.length;
          const gap = 3.5;
          const bw = (spectrumW - 14 - gap * (barCount - 1)) / barCount;

          for (let i = 0; i < barCount; i++) {
            const db = fft[i + 1] ?? -100;
            const norm = Math.min(1, Math.max(0, (db + 88) / 68));
            const idle = playing
              ? 0.22 + Math.abs(Math.sin(t * 0.008 + i * 0.7)) * 0.55
              : 0.16 + Math.sin((i / barCount) * Math.PI) * (0.45 + Math.sin(t * 0.003 + i) * 0.12);
            const lvl = Math.max(norm, idle * (playing ? 0.85 : 0.72));
            const bh = Math.max(5, lvl * (h - 14));
            const x = 8 + i * (bw + gap);
            ctx.fillStyle = barColors[i];
            ctx.beginPath();
            ctx.roundRect(x, h - 7 - bh, bw, bh, 2);
            ctx.fill();
          }

          // Subtle vertical divider inside OLED
          const midX = spectrumW + 6;
          ctx.strokeStyle = 'rgba(255,255,255,0.16)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(midX, 8);
          ctx.lineTo(midX, h - 8);
          ctx.stroke();

          // Right half: Glowing Cyan -> Magenta Oscilloscope Wave
          const waveStart = midX + 8;
          const waveW = w - waveStart - 10;
          const grad = ctx.createLinearGradient(waveStart, 0, waveStart + waveW, 0);
          grad.addColorStop(0, '#00D4AA');
          grad.addColorStop(0.5, '#38BDF8');
          grad.addColorStop(1, '#FF3D9A');

          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.4;
          ctx.shadowColor = '#00D4AA';
          ctx.shadowBlur = 6;
          ctx.beginPath();

          const samples = 48;
          for (let i = 0; i < samples; i++) {
            const idx = Math.floor((i / samples) * wave.length);
            const raw = wave[idx] ?? 0;
            const idleWave =
              Math.sin(i * 0.65 + t * 0.006) *
              Math.sin((i / (samples - 1)) * Math.PI) *
              (playing ? 0.35 : 0.25);
            const val = Math.abs(raw) > 0.01 ? raw * 1.45 : idleWave;
            const px = waveStart + (i / (samples - 1)) * waveW;
            const py = h / 2 + val * (h * 0.42);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Show visual playhead on step 4 (column 5, 1-indexed) as crisp default preview if stopped, or live step when playing
  const displayPlayhead = isPlaying ? activeStep : 4;

  return (
    <div className="w-full h-full p-3 flex flex-col gap-3 overflow-hidden">
      {/* ================= 1. TOP TRANSPORT & MASTER OLED BAR ================= */}
      <section className="brutal-panel px-3 py-2 flex items-center justify-between gap-2.5 shrink-0">
        {/* Left: PLAY / STOP / REC CARD */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              playSfx('click', 0.8);
              void holoAudio.togglePlay();
            }}
            className={`brutal-btn h-[50px] px-4 rounded-xl flex items-center gap-1.5 text-[15px] font-black tracking-wide ${
              isPlaying
                ? 'bg-[#00D4AA] text-[#1A1A1F] ring-2 ring-[#1A1A1F]'
                : 'bg-[#00D4AA] text-[#1A1A1F]'
            }`}
          >
            <Play className={`w-4 h-4 fill-current ${isPlaying ? 'animate-pulse' : ''}`} />
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          <button
            onClick={() => {
              playSfx('click', 0.35);
              holoAudio.stopTransport();
            }}
            className="brutal-btn h-[50px] px-3.5 rounded-xl bg-[#FFFDF8] text-[#1A1A1F] flex items-center gap-1.5 text-[15px] font-black tracking-wide"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>STOP</span>
          </button>

          <button
            onClick={() => {
              playSfx('mintStamp');
              sendBeatToForge();
            }}
            title="灌录当前节拍快照送入 04 闪卡铸造屋"
            className="brutal-btn h-[50px] px-3.5 rounded-xl bg-[#FF5C2B] text-[#1A1A1F] flex items-center gap-2 text-[13px] font-black leading-tight text-left"
          >
            <span className="w-4 h-4 rounded-full bg-[#FFFDF8] border-[2.5px] border-[#1A1A1F] shrink-0" />
            <span>
              REC
              <br />
              CARD
            </span>
          </button>
        </div>

        {/* Center: Wide Dark Charcoal OLED Visualizer + Scale Lock Pill */}
        <div className="flex-1 h-[54px] rounded-2xl bg-[#181820] border-[2.5px] border-[#1A1A1F] px-2 flex items-center gap-2 min-w-[200px] overflow-hidden">
          <canvas
            ref={oledCanvasRef}
            width={360}
            height={50}
            className="flex-1 h-full min-w-0 block"
          />
          <button
            onClick={() => {
              playSfx('click', 0.75);
              cycleScale();
            }}
            title={`调式锁定：${SCALE_META[scale].zhLabel}（点击切换）`}
            className="h-8 px-3 rounded-full bg-[#FFFDF8] border-[2px] border-[#1A1A1F] font-mono-hw text-xs font-black text-[#1A1A1F] flex items-center gap-1 shrink-0 cursor-pointer hover:bg-[#FFD60A] transition-colors"
          >
            <span>{SCALE_META[scale].label}</span>
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
        </div>

        <div className="h-10 w-[2px] bg-[#1A1A1F]/25 shrink-0 hidden xl:block" />

        {/* Right: BPM Stepper + SWING Knob + 2x2 Presets */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* BPM Stepper Pill */}
          <div className="h-[42px] rounded-xl bg-[#FFFDF8] border-[2.5px] border-[#1A1A1F] shadow-[2px_2px_0px_0px_#1A1A1F] px-1.5 flex items-center gap-1">
            <button
              onClick={() => {
                playSfx('knobTick', 0.3);
                setBpm(bpm - 4);
              }}
              className="p-1 hover:bg-[#EDE7D9] rounded-lg cursor-pointer"
              aria-label="decrease bpm"
            >
              <ChevronLeft className="w-4 h-4 fill-current" />
            </button>
            <div className="px-2.5 py-1 rounded-lg bg-[#181820] font-mono-hw text-xs font-black text-[#FFFDF8] whitespace-nowrap">
              BPM {bpm}
            </div>
            <button
              onClick={() => {
                playSfx('knobTick', 0.8);
                setBpm(bpm + 4);
              }}
              className="p-1 hover:bg-[#EDE7D9] rounded-lg cursor-pointer"
              aria-label="increase bpm"
            >
              <ChevronRight className="w-4 h-4 fill-current" />
            </button>
          </div>

          {/* SWING Rotary Knob */}
          <BrutalKnob
            value={swing / 0.6}
            onChange={(v) => setSwing(v * 0.6)}
            color="#FFD60A"
            size={38}
            label="SWING"
            title={`摇摆度 Swing: ${Math.round(swing * 100)}%（上下拖拽调节）`}
          />

          {/* 2x2 Presets: MARKET / NIGHT / RAND / CLEAR */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                playSfx('cartridgeLock');
                applyBeatPreset('MARKET');
                pushToast({ text: '已加载预设：胡同早市 MARKET (120 BPM · 五声C)', accent: '#FFD60A' });
              }}
              className="brutal-pad px-2.5 py-1 rounded-lg bg-[#FFFDF8] hover:bg-[#FFD60A] text-[11px] font-black tracking-wide"
            >
              MARKET
            </button>
            <button
              onClick={() => {
                playSfx('cartridgeLock');
                applyBeatPreset('NIGHT');
                pushToast({ text: '已加载预设：赛博夜市 NIGHT (128 BPM · 霓虹小调)', accent: '#7C3AED' });
              }}
              className="brutal-pad px-2.5 py-1 rounded-lg bg-[#FFFDF8] hover:bg-[#7C3AED] hover:text-white text-[11px] font-black tracking-wide"
            >
              NIGHT
            </button>
            <button
              onClick={() => {
                playSfx('ratchet');
                randomizeBeat();
              }}
              className="brutal-pad px-2.5 py-1 rounded-lg bg-[#FFFDF8] hover:bg-[#00D4AA] text-[11px] font-black tracking-wide"
            >
              RAND
            </button>
            <button
              onClick={() => {
                playSfx('click', 0.2);
                clearBeat();
              }}
              className="brutal-pad px-2.5 py-1 rounded-lg bg-[#FFFDF8] hover:bg-[#FF5C2B] hover:text-white text-[11px] font-black tracking-wide"
            >
              CLEAR
            </button>
          </div>
        </div>
      </section>

      {/* ================= 2. MAIN 4-TRACK SEQUENCER CHASSIS ================= */}
      <section className="brutal-panel flex-1 flex flex-col px-3 py-2.5 min-h-0 overflow-hidden">
        {/* Step Column Numbers 1..16 Aligned Over the Pad Matrix */}
        <div className="grid grid-cols-[188px_156px_1fr] gap-3 items-center pb-1.5 shrink-0">
          <div className="text-[11px] font-black uppercase tracking-wider text-[#5C5C6B] pl-1">
            CARTRIDGE SLOTS
          </div>
          <div className="text-[11px] font-black uppercase tracking-wider text-[#5C5C6B] text-center">
            MIXER
          </div>
          <div className="grid grid-cols-16 gap-1.5 px-1">
            {Array.from({ length: 16 }, (_, stepIdx) => {
              const isGroupStart = stepIdx % 4 === 0;
              const isHead = displayPlayhead === stepIdx;
              return (
                <div
                  key={stepIdx}
                  className={`relative text-center font-mono-hw text-xs font-black transition-colors ${
                    isHead ? 'text-[#FF5C2B] scale-110' : 'text-[#1A1A1F]'
                  }`}
                >
                  {isGroupStart && (
                    <span className="absolute -left-[4px] top-0.5 bottom-0.5 w-[2px] bg-[#1A1A1F]/40" />
                  )}
                  {stepIdx + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4 Horizontal Track Rows + Continuous Vertical Glowing Playhead Column */}
        <div className="flex-1 grid grid-rows-4 gap-2 min-h-0 relative">
          {/* Continuous Vertical Neon Yellow Playhead Bar (1:1 Mockup 2!) */}
          {displayPlayhead >= 0 && displayPlayhead < 16 && (
            <div className="pointer-events-none absolute inset-0 z-20 grid grid-cols-[188px_156px_1fr] gap-3 px-2.5">
              <div />
              <div />
              <div className="grid grid-cols-16 gap-1.5 px-1 h-full">
                {Array.from({ length: 16 }, (_, idx) => (
                  <div
                    key={idx}
                    className={
                      idx === displayPlayhead
                        ? 'h-full -my-1 rounded-xl border-[3px] border-[#FFD60A] bg-[#FFD60A]/14 shadow-[0_0_16px_rgba(255,214,10,0.85),inset_0_0_10px_rgba(255,214,10,0.35)]'
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

            return (
              <div
                key={track.category}
                className="grid grid-cols-[188px_156px_1fr] gap-3 items-center rounded-2xl border-[2px] border-[#1A1A1F]/80 bg-[#FFFDF8] px-2.5 py-1.5 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]"
              >
                {/* LEFT: Physical Cartridge Sound-Card Slot + Eject Button */}
                <div className="flex items-stretch gap-1.5 h-full min-h-[68px]">
                  <button
                    onClick={() => void holoAudio.previewCard(card.id)}
                    title={`点击试听：${card.title}（${card.zhTitle}）`}
                    className="flex-1 rounded-xl bg-[#181820] border-[2.5px] border-[#1A1A1F] p-[3px] flex flex-col overflow-hidden cursor-pointer group hover:brightness-105"
                  >
                    {/* Yellow Cartridge Top Label Strip */}
                    <div className="bg-[#FFD60A] border-b-[2px] border-[#1A1A1F] rounded-t-[7px] px-2 py-[2px] flex items-center justify-between">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1F]/60" />
                      <span className="text-[11px] font-black tracking-wider text-[#1A1A1F] leading-none">
                        {track.category}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1F]/60" />
                    </div>
                    {/* Inserted Miniature Holographic Card */}
                    <div
                      className="relative flex-1 rounded-b-[7px] overflow-hidden holo-thumb-sheen flex items-center"
                      style={{
                        background:
                          'linear-gradient(120deg, #E9D5FF 0%, #BAE6FD 32%, #FEF08A 62%, #FBCFE8 100%)',
                      }}
                    >
                      <div className="w-14 h-full shrink-0 overflow-hidden border-r-[1.5px] border-[#1A1A1F]">
                        <CardArtwork artId={card.artId} />
                      </div>
                      <div className="flex-1 px-1.5 py-0.5 flex flex-col justify-between h-full">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="px-1 py-[1px] rounded text-[9px] font-black border border-[#1A1A1F]"
                            style={{ backgroundColor: rarMeta.bg, color: rarMeta.text }}
                          >
                            {rarMeta.label}
                          </span>
                          <span className="font-mono-hw text-[9px] font-black text-[#1A1A1F] bg-[#FFFDF8]/90 px-1 rounded border border-[#1A1A1F]/40">
                            {card.code}
                          </span>
                        </div>
                        <div className="text-[12px] font-black italic tracking-tight text-[#1A1A1F] truncate leading-none text-left drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]">
                          {card.shortTitle}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Eject / Swap Card Button */}
                  <button
                    onClick={() => {
                      playSfx('click', 0.7);
                      setSwapTrackIdx(trackIdx);
                    }}
                    title="更换此轨道插槽声卡"
                    className="brutal-pad w-7 rounded-xl bg-[#FFFDF8] hover:bg-[#FFD60A] flex flex-col items-center justify-center gap-0.5 shrink-0"
                  >
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-[#1A1A1F]">
                      <polygon points="8,3 14,10 2,10" />
                      <rect x="2" y="12" width="12" height="2" rx="0.5" />
                    </svg>
                  </button>
                </div>

                {/* MIDDLE: Compact Track Mixer (M/S + TONE Knob + VOL Slider) */}
                <div className="flex items-center gap-2 px-1 border-x-[1.5px] border-[#1A1A1F]/15 h-full">
                  {/* Mute / Solo Vertical Pair */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => {
                        playSfx('click', 0.4);
                        toggleTrackMute(trackIdx);
                      }}
                      title="静音该轨 (Mute)"
                      className={`w-7 h-6 rounded-md border-[2px] border-[#1A1A1F] font-mono-hw text-[11px] font-black cursor-pointer transition-colors ${
                        track.mute
                          ? 'bg-[#FF5C2B] text-white'
                          : 'bg-[#FFFDF8] text-[#1A1A1F] hover:bg-[#EDE7D9]'
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
                      className={`w-7 h-6 rounded-md border-[2px] border-[#1A1A1F] font-mono-hw text-[11px] font-black cursor-pointer transition-colors ${
                        track.solo
                          ? 'bg-[#FFD60A] text-[#1A1A1F]'
                          : 'bg-[#FFFDF8] text-[#1A1A1F] hover:bg-[#EDE7D9]'
                      }`}
                    >
                      S
                    </button>
                  </div>

                  {/* TONE Rotary Knob */}
                  <BrutalKnob
                    value={track.tone}
                    onChange={(val) => setTrackTone(trackIdx, val)}
                    color={catMeta.color}
                    size={36}
                    label="TONE"
                    title="上下拖拽调节轨道音色滤波与音高明亮感"
                  />

                  {/* VOL Horizontal Slider */}
                  <BrutalSlider
                    value={track.volume}
                    onChange={(val) => setTrackVolume(trackIdx, val)}
                    color={catMeta.color}
                    label="VOL"
                    height={13}
                    className="flex-1 min-w-[52px]"
                  />
                </div>

                {/* RIGHT: 16-Step Glowing Pad Matrix */}
                <div className="grid grid-cols-16 gap-1.5 h-full items-center px-1 relative">
                  {track.steps.map((isOn, stepIdx) => {
                    const isHead = displayPlayhead === stepIdx;
                    const isGroupStart = stepIdx % 4 === 0 && stepIdx > 0;
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
                          toggleStep(trackIdx, stepIdx, nextVal);
                          if (nextVal) {
                            void holoAudio.previewCard(card.id, {
                              stepIndex: stepIdx,
                              tone: track.tone,
                              velocity: 0.65,
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
                          backgroundColor: isOn ? catMeta.color : '#EDE7D9',
                        }}
                        className={`relative h-[46px] w-full rounded-[9px] brutal-pad transition-transform ${
                          isPlaying && isHead ? 'scale-[1.05] brightness-110 z-10' : ''
                        } ${isGroupStart ? 'ml-[1px]' : ''}`}
                        aria-label={`${track.category} step ${stepIdx + 1}`}
                      >
                        {/* Subtle top specular shine on active pads */}
                        {isOn && (
                          <span className="absolute inset-x-1.5 top-1 h-1.5 rounded-full bg-white/35 pointer-events-none" />
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
            { key: 'echo' as const, label: 'STREET ECHO', zh: '弄堂回声', bg: '#FF5C2B', text: '#FFFFFF' },
            { key: 'stutter' as const, label: 'STUTTER', zh: '鬼畜切拍', bg: '#00D4AA', text: '#1A1A1F' },
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
                className={`brutal-btn-lg h-[50px] px-4 rounded-2xl flex items-center justify-between ${
                  active ? 'brutal-btn-pressed ring-2 ring-[#FFD60A]' : ''
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-[2.5px] border-[#1A1A1F] transition-all ${
                    active
                      ? 'bg-[#A3E635] shadow-[0_0_10px_#A3E635]'
                      : 'bg-[#FFFDF8]/70'
                  }`}
                />
                <span className="text-[16px] font-black tracking-wider uppercase">{fx.label}</span>
                <span className="text-[10px] font-bold opacity-80 hidden sm:inline">
                  {active ? 'ON' : fx.zh}
                </span>
              </button>
            );
          })}
        </div>

        <div className="h-9 w-[2px] bg-[#1A1A1F]/25 shrink-0" />

        <button
          onClick={() => {
            playSfx('mintStamp');
            sendBeatToForge();
          }}
          className="brutal-btn-lg h-[50px] px-6 rounded-2xl bg-[#FFD60A] text-[#1A1A1F] text-[16px] font-black tracking-wide uppercase flex items-center gap-2 shrink-0"
        >
          <span>MINT THIS BEAT</span>
          <span className="text-xl leading-none">→</span>
        </button>
      </section>

      {/* ================= CARTRIDGE SWAP MODAL ================= */}
      {swapTrackIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          onClick={() => setSwapTrackIdx(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="brutal-panel w-[540px] max-w-full max-h-[80vh] flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 bg-[#FFD60A] border-b-[3px] border-[#1A1A1F] flex items-center justify-between">
              <div>
                <h3 className="text-base font-black uppercase text-[#1A1A1F]">
                  SWAP CARTRIDGE · 更换 {tracks[swapTrackIdx].category} 卡槽声卡
                </h3>
                <p className="text-xs font-bold text-[#1A1A1F]/75">
                  选择已收集的市井声卡插入卡槽（支持跨轨混搭！）
                </p>
              </div>
              <button
                onClick={() => setSwapTrackIdx(null)}
                className="brutal-btn w-8 h-8 rounded-lg bg-[#FFFDF8] flex items-center justify-center"
              >
                <X className="w-4 h-4" strokeWidth={3} />
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
                        void holoAudio.previewCard(c.id);
                        setSwapTrackIdx(null);
                      }}
                      className={`p-2 rounded-xl border-[2.5px] border-[#1A1A1F] flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFD60A] shadow-[3px_3px_0px_0px_#1A1A1F]'
                          : 'bg-[#FFFDF8] hover:bg-[#EDE7D9] shadow-[2px_2px_0px_0px_#1A1A1F]'
                      }`}
                    >
                      <div className="w-12 h-14 rounded-lg border-2 border-[#1A1A1F] overflow-hidden holo-thumb-sheen shrink-0">
                        <CardArtwork artId={c.artId} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-black border border-[#1A1A1F]"
                            style={{ backgroundColor: cat.color, color: cat.textColor }}
                          >
                            {cat.label}
                          </span>
                          <span className="font-mono-hw text-[10px] font-black">{c.code}</span>
                        </div>
                        <div className="text-xs font-black truncate mt-1">{c.title}</div>
                        <div className="text-[10px] font-bold text-[#5C5C6B] truncate">
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
