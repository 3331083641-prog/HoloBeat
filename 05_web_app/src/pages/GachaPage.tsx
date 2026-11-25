import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Disc3,
  FolderHeart,
  Lock,
  RotateCw,
  Send,
  Volume2,
  X,
} from 'lucide-react';
import { holoAudio } from '../audio/HoloAudioEngine';
import { useHoloSfx } from '../audio/useHoloSfx';
import { CardArtwork } from '../components/artwork/CardArtwork';
import { HoloCard } from '../components/holo/HoloCard';
import { SoundSourceIcon } from '../components/icons/SoundSourceIcon';
import { getArtBriefByCardId } from '../data/artBriefs';
import { CATEGORY_META, HOLO_FOIL_LIST, RARITY_META, getCardById } from '../data/soundCards';
import { CURATED_SOUNDSCAPES } from '../data/soundscapes';
import { useHeroCardSize } from '../hooks/useHeroCardSize';
import { useHoloStore } from '../store/useHoloStore';
import type { TrackCategory } from '../types/holo';
import { fireHoloConfetti } from '../utils/confetti';

const TRACK_CATEGORIES: TrackCategory[] = ['BEAT', 'PERC', 'MELODY', 'VIBE'];

export const GachaPage: React.FC = () => {
  const selectedId = useHoloStore((s) => s.selectedGachaCardId);
  const needsScratch = useHoloStore((s) => s.needsScratch);
  const pityCount = useHoloStore((s) => s.pityCount);
  const pullHistory = useHoloStore((s) => s.pullHistory);
  const pullCounts = useHoloStore((s) => s.pullCounts);
  const collection = useHoloStore((s) => s.collection);
  const tracks = useHoloStore((s) => s.tracks);
  const reducedMotion = useHoloStore((s) => s.reducedMotion);

  const pullGachaCard = useHoloStore((s) => s.pullGachaCard);
  const revealCurrentCard = useHoloStore((s) => s.revealCurrentCard);
  const selectGachaCard = useHoloStore((s) => s.selectGachaCard);
  const loadSoundscape = useHoloStore((s) => s.loadSoundscape);
  const sendCardToBeat = useHoloStore((s) => s.sendCardToBeat);
  const sendCardToPinball = useHoloStore((s) => s.sendCardToPinball);
  const setActivePage = useHoloStore((s) => s.setActivePage);
  const pushToast = useHoloStore((s) => s.pushToast);

  const playSfx = useHoloSfx();
  const card = getCardById(selectedId);
  const catInfo = CATEGORY_META[card.category];
  const rarInfo = RARITY_META[card.rarity];
  const foilMeta = HOLO_FOIL_LIST.find((f) => f.id === card.foil) ?? HOLO_FOIL_LIST[0];
  const brief = getArtBriefByCardId(card.id);
  const ownedCount = pullCounts[card.id] ?? 1;

  const [flipped, setFlipped] = useState(false);
  const [pullBusy, setPullBusy] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [capsuleBounce, setCapsuleBounce] = useState(false);
  const [chuteCapsuleColor, setChuteCapsuleColor] = useState<string | null>(null);
  const [vaultFlash, setVaultFlash] = useState(false);
  const [cardPopKey, setCardPopKey] = useState(0);
  const [leverAngle, setLeverAngle] = useState(0);
  const [deckPage, setDeckPage] = useState(0);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [soundscapeOpen, setSoundscapeOpen] = useState(false);

  const cardStageRef = useRef<HTMLDivElement>(null);
  const cardDims = useHeroCardSize(cardStageRef, {
    heightRatio: 0.91,
    maxWidthRatio: 0.88,
    minH: 250,
    maxH: 560,
  });

  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const burstEnergyRef = useRef(0);
  const leverDragRef = useRef<{ startY: number; triggered: boolean } | null>(null);

  useEffect(() => {
    setFlipped(false);
    setSlotPickerOpen(false);
  }, [selectedId]);

  // Retina OLED Live Waveform Visualizer
  useEffect(() => {
    let raf = 0;
    const draw = (t: number) => {
      const canvas = waveCanvasRef.current;
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssW = Math.max(120, canvas.clientWidth);
        const cssH = Math.max(48, canvas.clientHeight);
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

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(6, h / 2);
          ctx.lineTo(w - 6, h / 2);
          ctx.stroke();

          const waveData = holoAudio.getWaveformData();
          const meter = holoAudio.getMeterLevel();
          burstEnergyRef.current = Math.max(0, burstEnergyRef.current * 0.935);
          const energy = Math.max(meter, burstEnergyRef.current);

          const barCount = 32;
          const gap = 3;
          const barW = (w - 16 - gap * (barCount - 1)) / barCount;

          for (let i = 0; i < barCount; i++) {
            const sampleIdx = Math.floor((i / barCount) * waveData.length);
            const raw = Math.abs(waveData[sampleIdx] ?? 0);
            const centerEnv = Math.sin((i / (barCount - 1)) * Math.PI);
            const harmonic = reducedMotion
              ? 0.5
              : Math.abs(Math.sin(i * 0.72 + t * 0.0055)) * 0.55 + 0.45;
            const idleH = (0.1 + centerEnv * harmonic * 0.52) * (0.45 + energy * 0.95);
            const liveH = Math.min(0.95, raw * 3.8 + idleH);
            const bh = Math.max(4, liveH * (h - 14));
            const x = 8 + i * (barW + gap);
            const y = (h - bh) / 2;

            ctx.fillStyle = i % 3 === 0 ? '#FFD60A' : '#FF5C2B';
            ctx.beginPath();
            ctx.roundRect(x, y, barW, bh, 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const getHeroRect = () => {
    const r = cardStageRef.current?.getBoundingClientRect();
    if (!r) return undefined;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  const triggerShake = () => {
    if (reducedMotion) return;
    setShaking(false);
    setCapsuleBounce(true);
    requestAnimationFrame(() => setShaking(true));
    window.setTimeout(() => {
      setShaking(false);
      setCapsuleBounce(false);
    }, 420);
  };

  /**
   * Physical Causality Chain:
   * Lever Crank (with busy guard) -> Capsule Agitation -> Chute Opens & Capsule Drops ->
   * Card Emerges -> Scratch / Quick Unbox Reveal -> Audition -> Route to Creation!
   */
  const handlePull = (skipScratch = false) => {
    if (pullBusy) return;
    if (skipScratch && needsScratch) {
      handleReveal(card.id);
      return;
    }

    setPullBusy(true);
    setSlotPickerOpen(false);
    setSoundscapeOpen(false);
    playSfx('ratchet');
    triggerShake();
    setFlipped(false);
    setLeverAngle(66);

    const dropDelay = reducedMotion || skipScratch ? 110 : 230;
    window.setTimeout(() => setLeverAngle(0), reducedMotion ? 140 : 360);

    window.setTimeout(() => {
      playSfx('capsuleDrop');
      const { card: pulled, isNew, hitPity } = pullGachaCard(skipScratch);
      setChuteCapsuleColor(CATEGORY_META[pulled.category].color);
      window.setTimeout(() => setChuteCapsuleColor(null), 920);

      setCardPopKey((k) => k + 1);
      setDeckPage(0);
      setVaultFlash(true);
      window.setTimeout(() => setVaultFlash(false), 360);
      setPullBusy(false);

      if (skipScratch) {
        triggerRevealCelebration(pulled.id, pulled.rarity, isNew, hitPity);
      } else {
        pushToast({
          text: hitPity
            ? `保底高阶胶囊已落槽！按住刮开全息银膜，或点击「立即刮开」`
            : `扭蛋已落入出球舱口！刮开银膜揭晓市井声卡`,
          accent: '#7C3AED',
        });
      }
    }, dropDelay);
  };

  const triggerRevealCelebration = (
    cardId: string,
    rarity: string,
    isNew?: boolean,
    hitPity?: boolean
  ) => {
    const revealed = getCardById(cardId);
    const isHigh = rarity === 'SSR' || rarity === 'UR';
    if (isHigh) {
      playSfx('holoFanfare');
      if (!reducedMotion) fireHoloConfetti('high');
    } else if (rarity === 'SR') {
      playSfx('holoFanfare');
      if (!reducedMotion) fireHoloConfetti('normal');
    } else {
      playSfx('cartridgeLock');
    }

    burstEnergyRef.current = 1;
    void holoAudio.previewCard(revealed.id);
    const dupCount = useHoloStore.getState().pullCounts[revealed.id] ?? 1;
    pushToast({
      text: `${isNew ? '新发现 · ' : `已有 ×${dupCount} · `}${hitPity ? '保底出金 · ' : ''}${revealed.rarity} ${revealed.code}「${revealed.zhTitle}」`,
      accent: RARITY_META[revealed.rarity].bg,
    });
  };

  const handleReveal = (cardId: string) => {
    revealCurrentCard();
    const revealed = getCardById(cardId);
    triggerRevealCelebration(revealed.id, revealed.rarity);
  };

  const handlePreviewSound = () => {
    burstEnergyRef.current = 1;
    void holoAudio.previewCard(card.id);
  };

  const orderedDeck = [
    ...pullHistory.filter((id) => collection.includes(id)),
    ...collection.filter((id) => !pullHistory.includes(id)),
  ];
  const totalPages = Math.max(1, Math.ceil(orderedDeck.length / 6));
  const safePage = Math.min(deckPage, totalPages - 1);
  const visibleSlice = orderedDeck.slice(safePage * 6, safePage * 6 + 6);
  const deckSlots = Array.from({ length: 6 }, (_, i) => visibleSlice[i] ?? null);

  return (
    <div className="w-full h-full p-3.5 grid grid-cols-[minmax(270px,29%)_minmax(0,45%)_minmax(255px,26%)] gap-3.5 overflow-hidden">
      {/* ================= LEFT (29%): PHYSICAL GACHA MACHINE ================= */}
      <section className="relative flex items-stretch justify-center pr-5 min-h-0">
        <div
          className={`relative flex-1 bg-[#FFD60A] border-[2.5px] border-[#1A1A1F] rounded-[20px] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-4px_0_rgba(26,26,31,0.12),5px_5px_0px_0px_#1A1A1F] p-3 flex flex-col justify-between gap-2 ${
            shaking ? 'animate-gacha-shake' : ''
          }`}
        >
          {/* Machine Rubber Feet */}
          <div className="absolute -bottom-[9px] left-6 w-12 h-2 rounded-b-lg bg-[#64748B] border-[2px] border-[#1A1A1F]" />
          <div className="absolute -bottom-[9px] right-6 w-12 h-2 rounded-b-lg bg-[#64748B] border-[2px] border-[#1A1A1F]" />

          {/* Header Plate */}
          <div className="relative bg-[#FFFDF8] border-[2px] border-[#1A1A1F] rounded-2xl py-2 px-4 shadow-[0_3px_0_#1A1A1F] flex flex-col items-center justify-center shrink-0">
            <span className="absolute left-2.5 top-2 w-1.5 h-1.5 rounded-full bg-[#1A1A1F]" />
            <span className="absolute right-2.5 top-2 w-1.5 h-1.5 rounded-full bg-[#1A1A1F]" />
            <h1 className="text-[20px] zh-display text-[#1A1A1F] leading-none">
              声卡扭蛋机
            </h1>
            <span className="text-[11px] font-bold text-[#5E5E6E] mt-1 leading-none">
              把一条街，做成一张有声音的闪卡
            </span>
          </div>

          {/* Transparent Capsule Showcase Dome */}
          <div
            onClick={() => {
              playSfx('capsuleDrop');
              setCapsuleBounce(true);
              window.setTimeout(() => setCapsuleBounce(false), 400);
            }}
            title="点击橱窗轻晃胶囊"
            className="relative flex-1 min-h-[140px] rounded-[16px] border-[2.5px] border-[#1A1A1F] bg-gradient-to-b from-[#252436] via-[#1B1A28] to-[#12121A] overflow-hidden cursor-pointer shadow-[inset_0_8px_18px_rgba(0,0,0,0.72)] group flex flex-col"
          >
            <svg
              viewBox="0 0 260 320"
              preserveAspectRatio="xMidYMax slice"
              className={`w-full h-full transition-transform duration-300 ease-out ${
                capsuleBounce ? 'scale-[1.06] -rotate-2 translate-y-1' : 'group-hover:scale-[1.02]'
              }`}
            >
              <defs>
                <linearGradient id="gacha-pack-holo" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" />
                  <stop offset="35%" stopColor="#FFFDF8" />
                  <stop offset="68%" stopColor="#FFD60A" />
                  <stop offset="100%" stopColor="#00D4AA" />
                </linearGradient>
                <linearGradient id="gacha-pack-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FEF08A" />
                  <stop offset="50%" stopColor="#FF5C2B" />
                  <stop offset="100%" stopColor="#FFD60A" />
                </linearGradient>
              </defs>

              <g opacity="0.88">
                <circle cx="54" cy="148" r="34" fill="#FF5C2B" stroke="#1A1A1F" strokeWidth="3.5" />
                <path d="M20 148 A34 34 0 0 1 88 148 Z" fill="#FFFDF8" opacity="0.52" />
                <circle cx="130" cy="134" r="36" fill="#00D4AA" stroke="#1A1A1F" strokeWidth="3.5" />
                <path d="M94 134 A36 36 0 0 1 166 134 Z" fill="#FFFDF8" opacity="0.52" />
                <circle cx="204" cy="154" r="35" fill="#7C3AED" stroke="#1A1A1F" strokeWidth="3.5" />
                <path d="M169 154 A35 35 0 0 1 239 154 Z" fill="#EDE9FE" opacity="0.5" />
              </g>

              <g transform="translate(152, 68) rotate(13)">
                <rect x="0" y="0" width="60" height="86" rx="6" fill="url(#gacha-pack-holo)" stroke="#1A1A1F" strokeWidth="3.5" />
                <path d="M30 26 L35 39 L48 44 L35 49 L30 62 L25 49 L12 44 L25 39 Z" fill="#FFFDF8" stroke="#1A1A1F" strokeWidth="2.5" />
              </g>

              <g transform="translate(24, 152) rotate(-14)">
                <rect x="0" y="0" width="60" height="86" rx="6" fill="url(#gacha-pack-gold)" stroke="#1A1A1F" strokeWidth="3.5" />
                <path d="M30 26 L35 39 L48 44 L35 49 L30 62 L25 49 L12 44 L25 39 Z" fill="#1A1A1F" />
              </g>

              <g>
                <circle cx="96" cy="198" r="39" fill="#7C3AED" stroke="#1A1A1F" strokeWidth="4" />
                <path d="M57 198 A39 39 0 0 1 135 198 Z" fill="#EDE9FE" opacity="0.58" />
                <line x1="57" y1="198" x2="135" y2="198" stroke="#1A1A1F" strokeWidth="3" />

                <circle cx="164" cy="206" r="39" fill="#00D4AA" stroke="#1A1A1F" strokeWidth="4" />
                <path d="M125 206 A39 39 0 0 1 203 206 Z" fill="#CCFBF1" opacity="0.58" />
                <line x1="125" y1="206" x2="203" y2="206" stroke="#1A1A1F" strokeWidth="3" />

                <circle cx="48" cy="272" r="40" fill="#FFD60A" stroke="#1A1A1F" strokeWidth="4" />
                <path d="M8 272 A40 40 0 0 1 88 272 Z" fill="#FFFDF8" opacity="0.55" />

                <circle cx="122" cy="276" r="43" fill="#FF5C2B" stroke="#1A1A1F" strokeWidth="4" />
                <path d="M79 276 A43 43 0 0 1 165 276 Z" fill="#FFFDF8" opacity="0.55" />

                <circle cx="198" cy="282" r="39" fill="#7C3AED" stroke="#1A1A1F" strokeWidth="4" />
                <path d="M159 282 A39 39 0 0 1 237 282 Z" fill="#EDE9FE" opacity="0.55" />
              </g>

              <rect x="0" y="308" width="260" height="14" fill="#0F1016" />
              <line x1="0" y1="308" x2="260" y2="308" stroke="#1A1A1F" strokeWidth="3" />
            </svg>

            <div className="absolute top-2 left-2.5 px-2 py-0.5 rounded-md bg-black/60 border border-white/15 text-[11px] font-bold text-white/85 pointer-events-none">
              轻点摇晃
            </div>
          </div>

          {/* Physical Capsule Dispensing Chute */}
          <div className="relative h-10 rounded-xl bg-[#14151B] border-[2px] border-[#1A1A1F] shadow-[inset_0_4px_10px_rgba(0,0,0,0.85)] px-3 flex items-center justify-between overflow-hidden shrink-0">
            <span className="text-[12px] font-bold text-white/65">出球舱口</span>
            {chuteCapsuleColor ? (
              <div
                className="w-6 h-6 rounded-full border-[2px] border-[#1A1A1F] animate-capsule-chute relative overflow-hidden shadow-[0_0_12px_rgba(255,214,10,0.7)]"
                style={{ backgroundColor: chuteCapsuleColor }}
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-white/50 border-b border-[#1A1A1F]" />
              </div>
            ) : (
              <span className="text-[12px] font-bold text-[#00D4AA]">
                {pullBusy ? '出球中...' : '就绪 ●'}
              </span>
            )}
          </div>

          {/* Primary Controls: Pull + Quick Unbox + Pity */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              data-testid="gacha-pull-btn"
              disabled={pullBusy}
              onClick={() => handlePull(false)}
              className="brutal-btn-lg w-full py-2.5 rounded-[14px] bg-[#FF5C2B] text-[#FFFDF8] text-[16px] zh-display flex items-center justify-center gap-2 disabled:opacity-65 whitespace-nowrap"
            >
              <span>{pullBusy ? '胶囊滚落中...' : '扭取声卡'}</span>
            </button>

            <button
              data-testid="gacha-quick-btn"
              disabled={pullBusy}
              onClick={() => handlePull(true)}
              className="brutal-btn w-full py-1.5 rounded-xl bg-[#00D4AA] text-[#1A1A1F] text-[13px] font-bold whitespace-nowrap disabled:opacity-65"
            >
              {needsScratch ? '立即刮开银膜' : '快速拆封（跳过刮膜）'}
            </button>

            <div className="bg-[#FFFDF8] border-[2px] border-[#1A1A1F] rounded-xl px-3 py-1.5 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`w-2 h-2 rounded-full ${
                    pityCount >= 4 ? 'bg-[#FF5C2B] animate-led-soft' : 'bg-[#7C3AED]'
                  }`}
                />
                <span className="font-mono-hw text-[12px] font-bold text-[#1A1A1F] whitespace-nowrap">
                  SSR 保底 {pityCount}/5
                </span>
              </div>
              <div className="flex-1 h-3 rounded-full bg-[#EDE7D9] border-[2px] border-[#1A1A1F] p-[2px] grid grid-cols-5 gap-[2px]">
                {[0, 1, 2, 3, 4].map((seg) => (
                  <div
                    key={seg}
                    className={`h-full rounded-sm transition-all duration-200 ${
                      seg < pityCount
                        ? pityCount >= 4
                          ? 'bg-[#FF5C2B]'
                          : 'bg-[#7C3AED]'
                        : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Accessible Mechanical Pull Lever (Drag + Click + Keyboard Enter/Space/ArrowDown!) */}
        <div
          data-testid="gacha-lever"
          role="button"
          tabIndex={0}
          aria-label="拉动机械拉杆扭取声卡"
          aria-disabled={pullBusy}
          title="向下拖拽、点击或按回车/下方向键拉动拉杆"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
              e.preventDefault();
              handlePull(false);
            }
          }}
          onPointerDown={(e) => {
            if (pullBusy) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            leverDragRef.current = { startY: e.clientY, triggered: false };
          }}
          onPointerMove={(e) => {
            if (!leverDragRef.current || leverDragRef.current.triggered) return;
            const dy = Math.max(0, e.clientY - leverDragRef.current.startY);
            // Nonlinear tactile damping resistance near threshold
            const damped = Math.min(68, Math.pow(dy, 0.92) * 1.12);
            setLeverAngle(damped);
            if (damped >= 44) {
              leverDragRef.current.triggered = true;
              handlePull(false);
            }
          }}
          onPointerUp={() => {
            if (leverDragRef.current && !leverDragRef.current.triggered) {
              handlePull(false);
            }
            leverDragRef.current = null;
            window.setTimeout(() => setLeverAngle(0), 220);
          }}
          onPointerCancel={() => {
            leverDragRef.current = null;
            setLeverAngle(0);
          }}
          className="absolute right-0 top-[30%] w-9 h-36 flex items-center justify-start cursor-grab active:cursor-grabbing select-none z-20 group"
        >
          <div className="w-4 h-24 rounded-r-xl bg-gradient-to-b from-[#E2E8F0] via-[#94A3B8] to-[#64748B] border-[2px] border-l-0 border-[#1A1A1F] shadow-[3px_3px_0px_0px_#1A1A1F] flex items-center justify-center">
            <div className="w-1.5 h-12 rounded-full bg-[#14151B]" />
          </div>
          <div
            style={{
              transformOrigin: '4px 90%',
              transform: `rotate(${leverAngle}deg)`,
            }}
            className="absolute left-0.5 -top-8 w-8 h-28 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none flex flex-col items-center"
          >
            <div className="relative w-10 h-10 -ml-1 rounded-full bg-[#FF5C2B] border-[2.5px] border-[#1A1A1F] shadow-[2px_3px_0px_0px_#1A1A1F] group-hover:scale-105 transition-transform">
              <div className="absolute top-1.5 left-2 w-3 h-2 rounded-full bg-white/70 -rotate-25" />
            </div>
            <div className="w-3 flex-1 bg-gradient-to-r from-[#F8FAFC] via-[#CBD5E1] to-[#64748B] border-x-[2px] border-b-[2px] border-[#1A1A1F] rounded-b-full -mt-1" />
          </div>
        </div>
      </section>

      {/* ================= CENTER (45%): RESIZE-OBSERVER HERO HOLO STAGE ================= */}
      <section
        className={`brutal-oled relative flex flex-col items-center justify-between p-3.5 overflow-hidden min-h-0 transition-shadow duration-300 ${
          vaultFlash ? 'ring-4 ring-[#FFD60A]' : ''
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 44%, rgba(124, 58, 237, 0.14) 0%, rgba(20, 21, 27, 0) 64%), linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 28px 28px, 28px 28px',
        }}
      >
        {/* Top Stage Bar: Title + Curated Street Soundscapes Trigger + Foil Tag */}
        <div className="w-full flex items-center justify-between gap-2 text-white/75 text-[12px] font-bold shrink-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="zh-heading text-[14px] text-[#FFFDF8] whitespace-nowrap">
              全息声卡赏析
            </span>
            {ownedCount > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold text-[#00D4AA] whitespace-nowrap">
                已有 ×{ownedCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              data-testid="gacha-soundscapes-btn"
              onClick={() => {
                playSfx('click', 0.75);
                setSoundscapeOpen((v) => !v);
                setSlotPickerOpen(false);
              }}
              className={`px-2.5 py-1 rounded-full border text-[12px] font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                soundscapeOpen
                  ? 'bg-[#FFD60A] border-[#1A1A1F] text-[#1A1A1F]'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-[#FFD60A]'
              }`}
            >
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span>策展声景</span>
            </button>
            <span className="px-2.5 py-1 rounded-full bg-white/8 border border-white/15 text-[#FFFDF8]/85 text-[11px] font-bold whitespace-nowrap">
              {foilMeta.zhLabel} · {card.rarity}
            </span>
          </div>
        </div>

        {/* Dedicated Flex-1 Stage Container measured by ResizeObserver! */}
        <div
          ref={cardStageRef}
          data-testid="gacha-stage-container"
          className="flex-1 flex items-center justify-center w-full min-h-0 relative z-10 py-1.5"
        >
          <div key={cardPopKey} data-testid="gacha-hero-card-wrap" className="animate-card-pop">
            <HoloCard
              cardId={card.id}
              title={card.title}
              zhTitle={card.zhTitle}
              code={card.code}
              rarity={card.rarity}
              category={card.category}
              foil={card.foil}
              artId={card.artId}
              storyZh={card.storyZh}
              pairingHintZh={card.pairingHintZh}
              synthFormula={card.synthFormula}
              recommendedBpm={card.recommendedBpm}
              stats={card.stats}
              ownedCount={ownedCount}
              flipped={flipped}
              needsScratch={needsScratch}
              onScratchReveal={() => handleReveal(card.id)}
              showAura
              idleShimmer
              width={cardDims.w}
              height={cardDims.h}
            />
          </div>

          {/* Curated Street Soundscapes Overlay (清晨弄堂 / 午后街机 / 夜市灯火) */}
          {soundscapeOpen && (
            <div className="absolute inset-2 z-30 rounded-2xl bg-[#14151B]/97 border-[2.5px] border-[#FFD60A] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.82)] flex flex-col justify-between gap-2.5 overflow-y-auto holo-scroll animate-card-pop">
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-[17px] zh-display text-[#FFD60A]">
                    市井策展声景入口
                  </h2>
                  <p className="text-[12px] text-white/75 mt-0.5">
                    受中国街巷意象启发的声音转译场景 · 一键载入成套声卡与 A/B 示范乐句
                  </p>
                </div>
                <button
                  onClick={() => setSoundscapeOpen(false)}
                  aria-label="关闭策展声景"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-2.5 justify-center">
                {CURATED_SOUNDSCAPES.map((sc) => (
                  <div
                    key={sc.id}
                    className="rounded-xl bg-white/[0.06] border border-white/15 p-3 flex flex-col gap-2 hover:border-[#FFD60A]/70 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded-md text-[11px] font-bold text-[#1A1A1F]"
                          style={{ backgroundColor: sc.accentColor, color: sc.accentColor === '#7C3AED' || sc.accentColor === '#FF5C2B' ? '#FFFDF8' : '#1A1A1F' }}
                        >
                          {sc.timeTag}
                        </span>
                        <span className="text-[15px] zh-heading text-[#FFFDF8]">{sc.title}</span>
                      </div>
                      <button
                        data-testid={`soundscape-load-${sc.id}`}
                        onClick={() => {
                          playSfx('cartridgeLock');
                          setSoundscapeOpen(false);
                          loadSoundscape(sc.id);
                        }}
                        className="brutal-pad px-3 py-1 rounded-lg bg-[#00D4AA] text-[#1A1A1F] text-[12px] font-bold whitespace-nowrap"
                      >
                        装入编曲台 →
                      </button>
                    </div>
                    <p className="text-[12px] text-white/85 leading-relaxed">{sc.storyZh}</p>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                      <div className="flex items-center gap-1.5">
                        {sc.cardIds.map((cid) => (
                          <span
                            key={cid}
                            title={getCardById(cid).zhTitle}
                            className="w-7 h-7 rounded-lg bg-[#FFFDF8] border border-[#1A1A1F] flex items-center justify-center"
                          >
                            <SoundSourceIcon cardId={cid} size={20} />
                          </span>
                        ))}
                      </div>
                      <span className="text-[11px] text-white/60 truncate">
                        视觉母题：{sc.visualMotifZh}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* A/B Preview & Target Track Slot Selector Popover */}
          {slotPickerOpen && (
            <div className="absolute bottom-2 inset-x-2 z-30 rounded-2xl bg-[#14151B]/97 border-[2px] border-[#FFD60A] p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.78)] animate-card-pop">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[13px] zh-heading text-[#FFD60A]">
                    选择装入的编曲轨道
                  </span>
                  <p className="text-[12px] text-white/80">
                    先试听对比轨道旧音色与「{card.zhTitle}」，装入时保留原有节奏
                  </p>
                </div>
                <button
                  onClick={() => setSlotPickerOpen(false)}
                  aria-label="关闭轨道选择"
                  className="p-1 text-white/65 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TRACK_CATEGORIES.map((cat, idx) => {
                  const currTrackCard = getCardById(tracks[idx].cardId);
                  const cm = CATEGORY_META[cat];
                  const isRecommended = cat === card.category;
                  return (
                    <div
                      key={cat}
                      className={`rounded-xl border p-2 flex items-center justify-between gap-2 ${
                        isRecommended
                          ? 'bg-white/10 border-[#FFD60A]'
                          : 'bg-white/5 border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-[#FFFDF8] border border-[#1A1A1F] flex items-center justify-center shrink-0">
                          <SoundSourceIcon cardId={currTrackCard.id} size={20} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span
                              className="px-1.5 py-[1px] rounded text-[10px] font-bold"
                              style={{ backgroundColor: cm.color, color: cm.textColor }}
                            >
                              {cm.label}
                            </span>
                            {isRecommended && (
                              <span className="text-[10px] font-bold text-[#FFD60A]">推荐</span>
                            )}
                          </div>
                          <div className="text-[11px] font-medium text-white/85 truncate mt-0.5">
                            当前：{currTrackCard.zhTitle}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => void holoAudio.previewCard(currTrackCard.id)}
                          title="试听轨道当前旧音色"
                          className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white cursor-pointer whitespace-nowrap"
                        >
                          听旧音
                        </button>
                        <button
                          onClick={() => {
                            playSfx('cartridgeLock');
                            setSlotPickerOpen(false);
                            sendCardToBeat(card.id, idx, true, getHeroRect());
                          }}
                          className="px-2.5 py-1 rounded-md bg-[#00D4AA] hover:brightness-110 text-[#1A1A1F] text-[11px] font-bold cursor-pointer whitespace-nowrap"
                        >
                          装入→
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Primary Next-Step CTA Bar */}
        <div className="w-full flex flex-col gap-2 pt-1 relative z-10 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handlePreviewSound}
              className="brutal-btn py-2 px-2 rounded-xl bg-[#00D4AA] text-[#1A1A1F] text-[14px] zh-heading flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Volume2 className="w-4 h-4 shrink-0" strokeWidth={2.6} />
              <span>试听音色</span>
            </button>
            <button
              data-testid="gacha-slot-btn"
              onClick={() => {
                playSfx('click', 0.8);
                setSoundscapeOpen(false);
                setSlotPickerOpen((v) => !v);
              }}
              className="brutal-btn py-2 px-2 rounded-xl bg-[#7C3AED] text-white text-[14px] zh-heading flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-4 h-4 shrink-0" strokeWidth={2.6} />
              <span>装入节拍台</span>
            </button>
            <button
              data-testid="gacha-flip-btn"
              onClick={() => {
                playSfx('cardFlip');
                setFlipped((f) => !f);
              }}
              className="brutal-btn py-2 px-2 rounded-xl bg-[#FFFDF8] text-[#1A1A1F] text-[14px] zh-heading flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <RotateCw className="w-4 h-4 shrink-0" strokeWidth={2.6} />
              <span>{flipped ? '查看正面' : '翻看卡背'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 px-0.5">
            <button
              onClick={() => {
                playSfx('cartridgeLock');
                sendCardToPinball(card.id, true, getHeroRect());
              }}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-white/8 hover:bg-white/15 border border-white/15 text-[12px] font-bold text-[#00D4AA] flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Disc3 className="w-3.5 h-3.5 shrink-0" />
              <span>送入弹珠剧场</span>
            </button>
            <button
              onClick={() => {
                playSfx('tab');
                setActivePage('forge');
              }}
              className="py-1.5 px-3 rounded-lg bg-white/8 hover:bg-white/15 border border-white/15 text-[12px] font-bold text-white/85 flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <FolderHeart className="w-3.5 h-3.5 text-[#FFD60A] shrink-0" />
              <span>前往闪卡铸造</span>
            </button>
          </div>
        </div>
      </section>

      {/* ================= RIGHT (26%): SOUND PROFILE & RECENT DECK ================= */}
      <section className="flex flex-col gap-3 min-h-0">
        <div className="brutal-panel p-3.5 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-[#EDE7D9] border-[2px] border-[#1A1A1F] flex items-center justify-center shrink-0">
                <SoundSourceIcon cardId={card.id} size={22} />
              </span>
              <div className="min-w-0">
                <div className="text-[15px] zh-heading text-[#1A1A1F] truncate leading-tight">
                  {card.zhTitle}
                </div>
                <div className="text-[11px] text-[#5E5E6E] truncate">
                  {brief.sourceObject}
                </div>
              </div>
            </div>
            <span
              className="px-2 py-0.5 rounded-full border-[2px] border-[#1A1A1F] text-[11px] font-bold whitespace-nowrap shrink-0"
              style={{ backgroundColor: rarInfo.bg, color: rarInfo.text }}
            >
              {rarInfo.label}
            </span>
          </div>

          <div
            onClick={handlePreviewSound}
            title="点击波形试听声卡音色"
            className="relative oled-scanlines w-full h-[64px] rounded-xl bg-[#14151B] border-[2px] border-[#1A1A1F] shadow-[inset_0_3px_10px_rgba(0,0,0,0.65)] overflow-hidden cursor-pointer group"
          >
            <canvas ref={waveCanvasRef} width={280} height={64} className="w-full h-full block" />
            <span className="absolute top-1.5 right-2 text-[10.5px] font-bold text-white/60 group-hover:text-[#00D4AA] transition-colors">
              点击试听
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-[#5E5E6E]">音色气质（风格倾向）</span>
            <span className="font-mono-hw font-bold text-[#5E5E6E]">
              推荐 {card.recommendedBpm} BPM
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { label: '冲击', val: card.stats.punch, color: '#FF5C2B' },
              { label: '光泽', val: card.stats.shine, color: '#FFD60A' },
              { label: '氛围', val: card.stats.vibe, color: '#7C3AED' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className="w-[46px] py-0.5 text-center rounded-full bg-[#FFFDF8] border-[1.5px] border-[#1A1A1F] text-[11px] font-bold text-[#1A1A1F] shrink-0">
                  {stat.label}
                </span>
                <div className="flex-1 h-3 rounded-full bg-[#EDE7D9] border-[1.5px] border-[#1A1A1F] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 border-r-[1.5px] border-[#1A1A1F]"
                    style={{
                      width: `${stat.val}%`,
                      backgroundColor: stat.color,
                    }}
                  />
                </div>
                <span className="font-mono-hw text-[11px] font-bold text-[#5E5E6E] w-6 text-right shrink-0">
                  {stat.val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RECENT DECK 2x3 (Restrained Matte Styling so Center Card Keeps Focus!) */}
        <div className="brutal-panel p-3.5 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div>
              <h2 className="text-[16px] zh-heading text-[#1A1A1F] leading-none">
                近期抽到
              </h2>
              <span className="text-[11px] text-[#5E5E6E]">点击切换赏析与试听</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    playSfx('click');
                    setDeckPage((p) => (p - 1 + totalPages) % totalPages);
                  }}
                  aria-label="上一页声卡"
                  className="brutal-pad w-6 h-6 rounded-md bg-[#EDE7D9] flex items-center justify-center"
                >
                  <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.6} />
                </button>
                <span className="font-mono-hw text-[11px] font-bold px-1">
                  {safePage + 1}/{totalPages}
                </span>
                <button
                  onClick={() => {
                    playSfx('click');
                    setDeckPage((p) => (p + 1) % totalPages);
                  }}
                  aria-label="下一页声卡"
                  className="brutal-pad w-6 h-6 rounded-md bg-[#EDE7D9] flex items-center justify-center"
                >
                  <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.6} />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 grid grid-cols-2 grid-rows-3 gap-2 min-h-0">
            {deckSlots.map((slotCardId, idx) => {
              if (!slotCardId) {
                return (
                  <button
                    key={`empty-${idx}`}
                    onClick={() => handlePull(false)}
                    className="rounded-xl bg-[#EDE7D9]/75 border-[1.5px] border-dashed border-[#1A1A1F]/30 flex flex-col items-center justify-center gap-1 text-[#5E5E6E] hover:bg-[#EDE7D9] hover:text-[#1A1A1F] transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 opacity-60" />
                    <span className="text-[11px] font-bold">扭取解锁</span>
                  </button>
                );
              }

              const slotCard = getCardById(slotCardId);
              const slotRar = RARITY_META[slotCard.rarity];
              const isSelected = slotCard.id === card.id;
              return (
                <button
                  key={slotCard.id}
                  onClick={() => {
                    playSfx('click', 0.8);
                    selectGachaCard(slotCard.id);
                    burstEnergyRef.current = 0.85;
                    void holoAudio.previewCard(slotCard.id);
                  }}
                  className={`relative rounded-xl border-[2px] border-[#1A1A1F] overflow-hidden flex flex-col bg-[#14151B] transition-transform duration-150 cursor-pointer hover:-translate-y-0.5 ${
                    isSelected
                      ? 'ring-2 ring-[#FF5C2B] shadow-[2.5px_2.5px_0px_#1A1A1F]'
                      : 'shadow-[1.5px_1.5px_0px_rgba(26,26,31,0.5)]'
                  }`}
                >
                  <div className="relative flex-1 w-full overflow-hidden">
                    <CardArtwork artId={slotCard.artId} />
                    <span
                      className="absolute top-1 left-1 px-1.5 py-[0.5px] rounded text-[9px] font-bold border border-[#1A1A1F]"
                      style={{ backgroundColor: slotRar.bg, color: slotRar.text }}
                    >
                      {slotRar.label}
                    </span>
                    <span className="absolute top-1 right-1 px-1 py-[0.5px] rounded bg-[#FFFDF8]/92 font-mono-hw text-[9px] font-bold text-[#1A1A1F]">
                      {slotCard.code}
                    </span>
                  </div>
                  <div className="w-full bg-[#FFFDF8] border-t-[1.5px] border-[#1A1A1F] py-0.5 px-1.5 text-center shrink-0">
                    <span className="block text-[11px] font-bold text-[#1A1A1F] truncate">
                      {slotCard.shortTitle}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
