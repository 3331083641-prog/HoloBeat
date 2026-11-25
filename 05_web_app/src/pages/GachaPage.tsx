import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
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
import { CATEGORY_META, HOLO_FOIL_LIST, RARITY_META, getCardById } from '../data/soundCards';
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

  const pullGachaCard = useHoloStore((s) => s.pullGachaCard);
  const revealCurrentCard = useHoloStore((s) => s.revealCurrentCard);
  const selectGachaCard = useHoloStore((s) => s.selectGachaCard);
  const sendCardToBeat = useHoloStore((s) => s.sendCardToBeat);
  const sendCardToPinball = useHoloStore((s) => s.sendCardToPinball);
  const setActivePage = useHoloStore((s) => s.setActivePage);
  const pushToast = useHoloStore((s) => s.pushToast);

  const playSfx = useHoloSfx();
  const card = getCardById(selectedId);
  const catInfo = CATEGORY_META[card.category];
  const rarInfo = RARITY_META[card.rarity];
  const foilMeta = HOLO_FOIL_LIST.find((f) => f.id === card.foil) ?? HOLO_FOIL_LIST[0];

  const [flipped, setFlipped] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [capsuleBounce, setCapsuleBounce] = useState(false);
  const [chuteCapsuleColor, setChuteCapsuleColor] = useState<string | null>(null);
  const [vaultFlash, setVaultFlash] = useState(false);
  const [cardPopKey, setCardPopKey] = useState(0);
  const [leverAngle, setLeverAngle] = useState(0);
  const [deckPage, setDeckPage] = useState(0);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [cardDims, setCardDims] = useState({ w: 306, h: 428 });

  useEffect(() => {
    const updateDims = () => {
      const vh = window.innerHeight;
      if (vh < 740) setCardDims({ w: 236, h: 330 });
      else if (vh < 820) setCardDims({ w: 264, h: 370 });
      else if (vh < 940) setCardDims({ w: 286, h: 400 });
      else setCardDims({ w: 306, h: 428 });
    };
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const burstEnergyRef = useRef(0);
  const leverDragRef = useRef<{ startY: number; triggered: boolean } | null>(null);

  useEffect(() => {
    setFlipped(false);
    setSlotPickerOpen(false);
  }, [selectedId]);

  // Retina OLED Live Waveform Visualizer (responds to real Web Audio output)
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

          const barCount = 34;
          const gap = 3;
          const barW = (w - 16 - gap * (barCount - 1)) / barCount;

          for (let i = 0; i < barCount; i++) {
            const sampleIdx = Math.floor((i / barCount) * waveData.length);
            const raw = Math.abs(waveData[sampleIdx] ?? 0);
            const centerEnv = Math.sin((i / (barCount - 1)) * Math.PI);
            const harmonic = Math.abs(Math.sin(i * 0.72 + t * 0.0055)) * 0.55 + 0.45;
            const idleH = (0.1 + centerEnv * harmonic * 0.54) * (0.55 + energy * 0.95);
            const liveH = Math.min(0.95, raw * 3.8 + idleH);
            const bh = Math.max(4, liveH * (h - 14));
            const x = 8 + i * (barW + gap);
            const y = (h - bh) / 2;

            ctx.fillStyle = i % 3 === 0 ? '#FFD426' : '#FF5526';
            ctx.shadowColor = '#FF5526';
            ctx.shadowBlur = energy > 0.14 ? 9 : 3;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, bh, 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const triggerShake = () => {
    setShaking(false);
    setCapsuleBounce(true);
    requestAnimationFrame(() => setShaking(true));
    window.setTimeout(() => {
      setShaking(false);
      setCapsuleBounce(false);
    }, 440);
  };

  /**
   * Physical Causality Sequence:
   * Lever Crank -> Gear Ratchet & Capsule Agitation -> Capsule Drops Into Bottom Chute ->
   * Foil Pack Emerges Onto Vault -> Scratch or Quick Unbox Reveal!
   */
  const handlePull = (skipScratch = false) => {
    if (skipScratch && needsScratch) {
      handleReveal(card.id);
      return;
    }

    setSlotPickerOpen(false);
    playSfx('ratchet');
    triggerShake();
    setFlipped(false);
    setLeverAngle(66);
    window.setTimeout(() => setLeverAngle(0), 360);

    // Stage 1: Capsule drops into visible dispensing chute
    window.setTimeout(() => {
      playSfx('capsuleDrop');
      const { card: pulled, isNew, hitPity } = pullGachaCard(skipScratch);
      setChuteCapsuleColor(CATEGORY_META[pulled.category].color);
      window.setTimeout(() => setChuteCapsuleColor(null), 950);

      // Stage 2: Card emerges onto showcase vault
      setCardPopKey((k) => k + 1);
      setDeckPage(0);
      setVaultFlash(true);
      window.setTimeout(() => setVaultFlash(false), 380);

      if (skipScratch) {
        triggerRevealCelebration(pulled.id, pulled.rarity, isNew, hitPity);
      } else {
        pushToast({
          text: hitPity
            ? `✨ 保底高阶胶囊已落槽！动手刮开银膜揭晓稀有声卡`
            : `🎁 扭蛋已落入出卡槽！按住刮开全息银膜，或点 QUICK UNBOX 秒拆`,
          accent: '#7C3AED',
        });
      }
    }, 210);
  };

  const triggerRevealCelebration = (
    cardId: string,
    rarity: string,
    isNew?: boolean,
    hitPity?: boolean
  ) => {
    const revealed = getCardById(cardId);
    const isHigh = rarity === 'SSR' || rarity === 'UR';
    // Restrained tiered ceremony: N/R clean crisp pop, SR prism chime, SSR/UR full confetti & fanfare!
    if (isHigh) {
      playSfx('holoFanfare');
      fireHoloConfetti('high');
    } else if (rarity === 'SR') {
      playSfx('holoFanfare');
      fireHoloConfetti('normal');
    } else {
      playSfx('cartridgeLock');
    }

    burstEnergyRef.current = 1;
    void holoAudio.previewCard(revealed.id);
    pushToast({
      text: `${isNew ? 'NEW! ' : ''}${hitPity ? '保底出金 · ' : ''}${revealed.rarity} ${revealed.code} ${revealed.title}（${revealed.zhTitle}）`,
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
    <div className="w-full h-full p-3.5 grid grid-cols-[minmax(280px,30%)_1fr_minmax(265px,28%)] gap-4 overflow-hidden">
      {/* ================= LEFT COLUMN: INDUSTRIAL TOY GACHA MACHINE ================= */}
      <section className="relative flex items-stretch justify-center pr-5 min-h-0">
        <div
          className={`relative flex-1 bg-[#FFD426] border-[3px] border-[#17171C] rounded-[24px] shadow-[inset_0_2px_0_rgba(255,255,255,0.65),inset_0_-4px_0_rgba(23,23,28,0.14),5px_5px_0px_0px_#17171C] p-3 flex flex-col justify-between gap-2 ${
            shaking ? 'animate-gacha-shake' : ''
          }`}
        >
          {/* Machine Rubber Feet */}
          <div className="absolute -bottom-[10px] left-6 w-14 h-2.5 rounded-b-lg bg-[#64748B] border-[2.5px] border-[#17171C]" />
          <div className="absolute -bottom-[10px] right-6 w-14 h-2.5 rounded-b-lg bg-[#64748B] border-[2.5px] border-[#17171C]" />

          {/* Top Riveted Nameplate */}
          <div className="relative bg-[#FBF9F4] border-[2.5px] border-[#17171C] rounded-2xl py-1.5 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_3px_0_#17171C] flex flex-col items-center justify-center shrink-0">
            <span className="absolute left-2.5 top-2 w-1.5 h-1.5 rounded-full bg-[#17171C]" />
            <span className="absolute right-2.5 top-2 w-1.5 h-1.5 rounded-full bg-[#17171C]" />
            <span className="absolute left-2.5 bottom-2 w-1.5 h-1.5 rounded-full bg-[#17171C]" />
            <span className="absolute right-2.5 bottom-2 w-1.5 h-1.5 rounded-full bg-[#17171C]" />
            <h1 className="text-[19px] font-black tracking-wide text-[#17171C] leading-none">
              HOLO GACHA
            </h1>
            <span className="hw-silkscreen !text-[8px] mt-0.5 leading-none">
              UNIT 01 // DISCOVER SOUND
            </span>
          </div>

          {/* Transparent Capsule Showcase Dome */}
          <div
            onClick={() => {
              playSfx('capsuleDrop');
              setCapsuleBounce(true);
              window.setTimeout(() => setCapsuleBounce(false), 420);
            }}
            title="点击橱窗摇晃扭蛋与全息卡包！"
            className="relative flex-1 min-h-[150px] rounded-[18px] border-[3px] border-[#17171C] bg-gradient-to-b from-[#252436] via-[#1B1A28] to-[#12121A] overflow-hidden cursor-pointer shadow-[inset_0_8px_20px_rgba(0,0,0,0.72)] group flex flex-col"
          >
            <div
              className="absolute inset-x-0 top-0 h-28 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 80% 70% at 50% 0%, rgba(255, 212, 38, 0.2) 0%, rgba(124, 58, 237, 0.1) 52%, transparent 100%)',
              }}
            />

            <svg
              viewBox="0 0 260 320"
              preserveAspectRatio="xMidYMax slice"
              className={`w-full h-full transition-transform duration-300 ease-out ${
                capsuleBounce ? 'scale-[1.06] -rotate-2 translate-y-1' : 'group-hover:scale-[1.02]'
              }`}
            >
              <defs>
                <linearGradient id="gacha-pack-holo" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="30%" stopColor="#F8FAFC" />
                  <stop offset="55%" stopColor="#FF3D9A" />
                  <stop offset="80%" stopColor="#FFD426" />
                  <stop offset="100%" stopColor="#00D4AA" />
                </linearGradient>
                <linearGradient id="gacha-pack-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FEF08A" />
                  <stop offset="45%" stopColor="#F59E0B" />
                  <stop offset="75%" stopColor="#FFFBEB" />
                  <stop offset="100%" stopColor="#EA580C" />
                </linearGradient>
              </defs>

              <g opacity="0.88">
                <circle cx="52" cy="148" r="34" fill="#FF3D9A" stroke="#17171C" strokeWidth="3.5" />
                <path d="M18 148 A34 34 0 0 1 86 148 Z" fill="#FFFDF8" opacity="0.55" />
                <circle cx="128" cy="134" r="36" fill="#38BDF8" stroke="#17171C" strokeWidth="3.5" />
                <path d="M92 134 A36 36 0 0 1 164 134 Z" fill="#FFFDF8" opacity="0.52" />
                <circle cx="204" cy="154" r="35" fill="#7C3AED" stroke="#17171C" strokeWidth="3.5" />
                <path d="M169 154 A35 35 0 0 1 239 154 Z" fill="#E9D5FF" opacity="0.5" />
              </g>

              <g transform="translate(152, 68) rotate(13)">
                <rect x="0" y="0" width="60" height="88" rx="6" fill="url(#gacha-pack-holo)" stroke="#17171C" strokeWidth="3.5" />
                <line x1="0" y1="11" x2="60" y2="11" stroke="#17171C" strokeWidth="2.5" />
                <line x1="0" y1="77" x2="60" y2="77" stroke="#17171C" strokeWidth="2.5" />
                <path d="M30 26 L35 39 L48 44 L35 49 L30 62 L25 49 L12 44 L25 39 Z" fill="#FFFDF8" stroke="#17171C" strokeWidth="2.5" />
              </g>

              <g transform="translate(24, 152) rotate(-14)">
                <rect x="0" y="0" width="60" height="88" rx="6" fill="url(#gacha-pack-gold)" stroke="#17171C" strokeWidth="3.5" />
                <line x1="0" y1="11" x2="60" y2="11" stroke="#17171C" strokeWidth="2.5" />
                <line x1="0" y1="77" x2="60" y2="77" stroke="#17171C" strokeWidth="2.5" />
                <path d="M30 26 L35 39 L48 44 L35 49 L30 62 L25 49 L12 44 L25 39 Z" fill="#17171C" />
              </g>

              <g>
                <circle cx="96" cy="196" r="39" fill="#7C3AED" stroke="#17171C" strokeWidth="4" />
                <path d="M57 196 A39 39 0 0 1 135 196 Z" fill="#EDE9FE" opacity="0.58" />
                <line x1="57" y1="196" x2="135" y2="196" stroke="#17171C" strokeWidth="3" />
                <ellipse cx="82" cy="176" rx="10" ry="5" transform="rotate(-24 82 176)" fill="#FFFFFF" opacity="0.55" />

                <circle cx="164" cy="204" r="39" fill="#00D4AA" stroke="#17171C" strokeWidth="4" />
                <path d="M125 204 A39 39 0 0 1 203 204 Z" fill="#CCFBF1" opacity="0.58" />
                <line x1="125" y1="204" x2="203" y2="204" stroke="#17171C" strokeWidth="3" />
                <ellipse cx="150" cy="184" rx="10" ry="5" transform="rotate(-24 150 184)" fill="#FFFFFF" opacity="0.55" />

                <circle cx="222" cy="222" r="35" fill="#FF3D9A" stroke="#17171C" strokeWidth="4" />
                <path d="M187 222 A35 35 0 0 1 257 222 Z" fill="#FCE7F3" opacity="0.55" />
                <line x1="187" y1="222" x2="257" y2="222" stroke="#17171C" strokeWidth="3" />
              </g>

              <g transform="translate(172, 206) rotate(11)">
                <rect x="0" y="0" width="60" height="88" rx="6" fill="url(#gacha-pack-holo)" stroke="#17171C" strokeWidth="3.5" />
                <path d="M30 26 L35 39 L48 44 L35 49 L30 62 L25 49 L12 44 L25 39 Z" fill="#FFFDF8" stroke="#17171C" strokeWidth="2.5" />
              </g>

              <g>
                <circle cx="48" cy="272" r="40" fill="#FFD426" stroke="#17171C" strokeWidth="4" />
                <path d="M8 272 A40 40 0 0 1 88 272 Z" fill="#FFFBEB" opacity="0.58" />
                <line x1="8" y1="272" x2="88" y2="272" stroke="#17171C" strokeWidth="3" />

                <circle cx="122" cy="276" r="43" fill="#FF5526" stroke="#17171C" strokeWidth="4" />
                <path d="M79 276 A43 43 0 0 1 165 276 Z" fill="#FFFDF8" opacity="0.58" />
                <line x1="79" y1="276" x2="165" y2="276" stroke="#17171C" strokeWidth="3" />
                <ellipse cx="105" cy="253" rx="12" ry="6" transform="rotate(-22 105 253)" fill="#FFFFFF" opacity="0.6" />

                <circle cx="198" cy="284" r="39" fill="#38BDF8" stroke="#17171C" strokeWidth="4" />
                <path d="M159 284 A39 39 0 0 1 237 284 Z" fill="#E0F2FE" opacity="0.56" />
                <line x1="159" y1="284" x2="237" y2="284" stroke="#17171C" strokeWidth="3" />
              </g>

              <rect x="0" y="308" width="260" height="14" fill="#0F1016" />
              <line x1="0" y1="308" x2="260" y2="308" stroke="#17171C" strokeWidth="3" />
            </svg>

            <div className="absolute -top-6 -left-10 w-20 h-[140%] bg-white/14 rotate-[22deg] pointer-events-none" />
            <div className="absolute -top-6 left-11 w-5 h-[140%] bg-white/10 rotate-[22deg] pointer-events-none" />

            <div className="absolute top-2 left-2.5 px-2 py-0.5 rounded-md bg-black/55 border border-white/15 font-mono-hw text-[9px] font-bold text-white/75 tracking-wider pointer-events-none">
              TAP TO SHAKE
            </div>
          </div>

          {/* Physical Capsule Dispensing Chute (Shows Real Dropped Capsule on Pull!) */}
          <div className="relative h-9 rounded-xl bg-[#14151B] border-[2.5px] border-[#17171C] shadow-[inset_0_4px_10px_rgba(0,0,0,0.85)] px-3 flex items-center justify-between overflow-hidden shrink-0">
            <span className="font-mono-hw text-[9px] font-bold tracking-[0.14em] text-white/45">
              DISPENSE CHUTE
            </span>
            {chuteCapsuleColor ? (
              <div
                className="w-6 h-6 rounded-full border-[2px] border-[#17171C] animate-capsule-chute relative overflow-hidden shadow-[0_0_12px_rgba(255,212,38,0.7)]"
                style={{ backgroundColor: chuteCapsuleColor }}
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-white/50 border-b border-[#17171C]" />
              </div>
            ) : (
              <span className="font-mono-hw text-[9px] font-bold text-[#00D4AA]/70">
                READY ●
              </span>
            )}
          </div>

          {/* Bottom Control Cluster */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="relative px-1">
              <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-[#17171C]/50" />
              <span className="absolute right-0 top-1.5 w-1.5 h-1.5 rounded-full bg-[#17171C]/50" />
              <button
                onClick={() => handlePull(false)}
                className="brutal-btn-lg w-full py-2.5 rounded-[15px] bg-[#FF5526] text-[#17171C] text-[19px] font-black tracking-wide uppercase flex items-center justify-center gap-2"
              >
                <span>PULL CARD</span>
              </button>
            </div>

            <div className="px-4">
              <button
                onClick={() => handlePull(true)}
                className="brutal-btn w-full py-1.5 rounded-full bg-[#00D4AA] text-[#17171C] text-xs font-black tracking-wider uppercase"
              >
                {needsScratch ? '✦ QUICK UNBOX · 立即刮开' : 'QUICK UNBOX · 秒开盲盒'}
              </button>
            </div>

            <div className="bg-[#FBF9F4] border-[2.5px] border-[#17171C] rounded-2xl px-3 py-1.5 flex items-center justify-between gap-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`w-2 h-2 rounded-full ${
                    pityCount >= 4 ? 'bg-[#FF5526] animate-led-soft' : 'bg-[#7C3AED]'
                  }`}
                />
                <span className="font-mono-hw text-[11px] font-black text-[#17171C] whitespace-nowrap">
                  SSR PITY {pityCount}/5
                </span>
              </div>
              <div className="flex-1 h-3.5 rounded-full bg-[#E7E1D3] border-[2px] border-[#17171C] p-[2px] grid grid-cols-5 gap-[2px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.16)]">
                {[0, 1, 2, 3, 4].map((seg) => (
                  <div
                    key={seg}
                    className={`h-full rounded-sm transition-all duration-200 ${
                      seg < pityCount
                        ? pityCount >= 4
                          ? 'bg-gradient-to-r from-[#7C3AED] to-[#FF3D9A]'
                          : 'bg-[#7C3AED]'
                        : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mechanical Pull Lever */}
        <div
          title="向下拖拽或点击拉杆抽卡！"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            leverDragRef.current = { startY: e.clientY, triggered: false };
          }}
          onPointerMove={(e) => {
            if (!leverDragRef.current || leverDragRef.current.triggered) return;
            const dy = Math.max(0, e.clientY - leverDragRef.current.startY);
            const nextAngle = Math.min(68, dy * 0.9);
            setLeverAngle(nextAngle);
            if (nextAngle >= 44) {
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
          className="absolute right-0 top-[31%] w-9 h-36 flex items-center justify-start cursor-grab active:cursor-grabbing select-none z-20 group"
        >
          <div className="w-4 h-24 rounded-r-xl bg-gradient-to-b from-[#E2E8F0] via-[#94A3B8] to-[#64748B] border-[2.5px] border-l-0 border-[#17171C] shadow-[3px_3px_0px_0px_#17171C] flex items-center justify-center">
            <div className="w-1.5 h-12 rounded-full bg-[#14151B]" />
          </div>
          <div
            style={{
              transformOrigin: '4px 90%',
              transform: `rotate(${leverAngle}deg)`,
            }}
            className="absolute left-0.5 -top-8 w-8 h-28 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none flex flex-col items-center"
          >
            <div className="relative w-10 h-10 -ml-1 rounded-full bg-[#FF5526] border-[2.5px] border-[#17171C] shadow-[2px_3px_0px_0px_#17171C] group-hover:scale-105 transition-transform">
              <div className="absolute top-1.5 left-2 w-3 h-2 rounded-full bg-white/70 -rotate-25" />
            </div>
            <div className="w-3 flex-1 bg-gradient-to-r from-[#F8FAFC] via-[#CBD5E1] to-[#64748B] border-x-[2.5px] border-b-[2.5px] border-[#17171C] rounded-b-full -mt-1" />
          </div>
        </div>
      </section>

      {/* ================= CENTER STAGE: 3D HOLOGRAPHIC CARD VAULT ================= */}
      <section
        className={`brutal-oled relative flex flex-col items-center justify-between p-4 overflow-hidden min-h-0 transition-shadow duration-300 ${
          vaultFlash ? 'ring-4 ring-[#FFD426]' : ''
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 44%, rgba(124, 58, 237, 0.14) 0%, rgba(20, 21, 27, 0) 64%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 28px 28px, 28px 28px',
        }}
      >
        <div className="w-full flex items-center justify-between gap-2 text-white/55 font-mono-hw text-[10px] tracking-[0.14em] shrink-0 z-10">
          <span className="flex items-center gap-1.5 whitespace-nowrap truncate">
            <span className="text-white/75 text-sm leading-none">+</span>
            <span>VAULT 01 // 3D HOLO</span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <span className="px-2 py-0.5 rounded-full bg-white/8 border border-white/15 text-[#FFD426] font-bold whitespace-nowrap">
              {foilMeta.label} · {card.rarity}
            </span>
            <span className="text-white/75 text-sm leading-none">+</span>
          </span>
        </div>

        {/* Center 3D Holographic Showcase Card */}
        <div className="flex-1 flex items-center justify-center w-full min-h-0 relative z-10 py-1">
          <div key={cardPopKey} className="animate-card-pop">
            <HoloCard
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
              ownedCount={pullCounts[card.id] ?? 1}
              flipped={flipped}
              needsScratch={needsScratch}
              onScratchReveal={() => handleReveal(card.id)}
              showAura
              idleShimmer
              width={cardDims.w}
              height={cardDims.h}
            />
          </div>

          {/* A/B Preview & Target Track Slot Selector Popover */}
          {slotPickerOpen && (
            <div className="absolute bottom-2 inset-x-2 z-30 rounded-2xl bg-[#14151B]/96 border-[2px] border-[#FFD426] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.75)] animate-card-pop">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-mono-hw text-[10px] font-bold tracking-widest text-[#FFD426] uppercase">
                    A/B PREVIEW & SLOT ROUTING · 选择装入轨道
                  </span>
                  <p className="text-[11px] font-bold text-white/80">
                    对比旧卡与新卡「{card.zhTitle}」，点击装入即飞入节拍台
                  </p>
                </div>
                <button
                  onClick={() => setSlotPickerOpen(false)}
                  className="p-1 text-white/60 hover:text-white cursor-pointer"
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
                          ? 'bg-white/10 border-[#FFD426]'
                          : 'bg-white/5 border-white/15'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span
                            className="px-1.5 py-[1px] rounded text-[9px] font-black"
                            style={{ backgroundColor: cm.color, color: cm.textColor }}
                          >
                            {cat}
                          </span>
                          {isRecommended && (
                            <span className="font-mono-hw text-[8.5px] font-bold text-[#FFD426]">
                              推荐
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] font-bold text-white/80 truncate mt-0.5">
                          当前: {currTrackCard.zhTitle}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => void holoAudio.previewCard(currTrackCard.id)}
                          title="试听轨道当前旧音色 (A)"
                          className="px-1.5 py-1 rounded-md bg-white/10 hover:bg-white/20 font-mono-hw text-[9.5px] font-bold text-white cursor-pointer"
                        >
                          听旧A
                        </button>
                        <button
                          onClick={() => {
                            playSfx('cartridgeLock');
                            setSlotPickerOpen(false);
                            sendCardToBeat(card.id, idx, true);
                          }}
                          className="px-2 py-1 rounded-md bg-[#00D4AA] hover:brightness-110 text-[#17171C] text-[10px] font-black cursor-pointer"
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

        {/* Bottom Tactile Action Bar (Clear Primary vs Secondary Hierarchy) */}
        <div className="w-full flex flex-col gap-2 pt-1.5 relative z-10 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handlePreviewSound}
              className="brutal-btn py-2 px-2 rounded-xl bg-[#00D4AA] text-[#17171C] text-[12px] font-black tracking-wide uppercase flex items-center justify-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5" strokeWidth={2.8} />
              <span>PLAY SOUND</span>
            </button>
            <button
              onClick={() => {
                playSfx('click', 0.8);
                setSlotPickerOpen((v) => !v);
              }}
              className="brutal-btn py-2 px-2 rounded-xl bg-[#7C3AED] text-white text-[12px] font-black tracking-wide uppercase flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" strokeWidth={2.8} />
              <span>SEND TO BEAT</span>
            </button>
            <button
              onClick={() => {
                playSfx('cardFlip');
                setFlipped((f) => !f);
              }}
              className="brutal-btn py-2 px-2 rounded-xl bg-[#FBF9F4] text-[#17171C] text-[12px] font-black tracking-wide uppercase flex items-center justify-center gap-1.5"
            >
              <RotateCw className="w-3.5 h-3.5" strokeWidth={2.8} />
              <span>{flipped ? 'SHOW FRONT' : 'FLIP INFO'}</span>
            </button>
          </div>

          {/* Subtle Secondary Creative Routing Strip */}
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              onClick={() => {
                playSfx('cartridgeLock');
                sendCardToPinball(card.id, true);
              }}
              className="flex-1 py-1 px-2.5 rounded-lg bg-white/8 hover:bg-white/15 border border-white/15 text-[10.5px] font-bold text-[#00D4AA] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Disc3 className="w-3 h-3" />
              <span>SEND TO PINBALL · 绑定弹珠机关</span>
            </button>
            <button
              onClick={() => {
                playSfx('tab');
                setActivePage('forge');
              }}
              className="py-1 px-2.5 rounded-lg bg-white/8 hover:bg-white/15 border border-white/15 text-[10.5px] font-bold text-white/80 flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <FolderHeart className="w-3 h-3 text-[#FFD426]" />
              <span>VIEW BINDER</span>
            </button>
          </div>
        </div>
      </section>

      {/* ================= RIGHT COLUMN: SOUND ARCHIVE & RECENT DECK ================= */}
      <section className="flex flex-col gap-3 min-h-0">
        <div className="brutal-panel p-3.5 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className="px-2.5 py-0.5 rounded-full border-[2px] border-[#17171C] font-mono-hw text-[11px] font-black tracking-wider shadow-[2px_2px_0px_0px_#17171C]"
              style={{ backgroundColor: rarInfo.bg, color: rarInfo.text }}
            >
              {rarInfo.label} · {catInfo.label}
            </span>
            <span className="text-xs font-extrabold text-[#17171C] truncate">
              {card.zhTitle}
            </span>
          </div>

          <div
            onClick={handlePreviewSound}
            title="点击波形试听声卡音色"
            className="relative oled-scanlines w-full h-[70px] rounded-xl bg-[#14151B] border-[2.5px] border-[#17171C] shadow-[inset_0_3px_10px_rgba(0,0,0,0.65)] overflow-hidden cursor-pointer group"
          >
            <canvas ref={waveCanvasRef} width={280} height={70} className="w-full h-full block" />
            <span className="absolute top-1.5 right-2 font-mono-hw text-[8.5px] font-bold tracking-widest text-white/45 group-hover:text-[#00D4AA] transition-colors">
              AUDITION ♪
            </span>
          </div>

          {/* Explicitly labeled artistic style profile tags */}
          <div className="flex items-center justify-between">
            <span className="hw-silkscreen !text-[8px]">STYLE PROFILE · 音色风格特征</span>
            <span className="hw-silkscreen !text-[8px]">REC {card.recommendedBpm} BPM</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { label: 'PUNCH', val: card.stats.punch, color: '#FF5526' },
              { label: 'SHINE', val: card.stats.shine, color: '#FFD426' },
              { label: 'VIBE', val: card.stats.vibe, color: '#7C3AED' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className="w-[56px] py-0.5 text-center rounded-full bg-[#FBF9F4] border-[2px] border-[#17171C] font-mono-hw text-[9.5px] font-black text-[#17171C] shrink-0">
                  {stat.label}
                </span>
                <div className="flex-1 h-3.5 rounded-full bg-[#E7E1D3] border-[2px] border-[#17171C] shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-350 ease-out border-r-[2px] border-[#17171C]"
                    style={{
                      width: `${stat.val}%`,
                      backgroundColor: stat.color,
                    }}
                  />
                </div>
                <span className="font-mono-hw text-[10px] font-black text-[#626272] w-6 text-right shrink-0">
                  {stat.val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RECENT DECK 2x3 */}
        <div className="brutal-panel p-3.5 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div>
              <h2 className="text-[14.5px] font-black tracking-wide uppercase text-[#17171C] leading-none">
                RECENT DECK
              </h2>
              <span className="hw-silkscreen !text-[8.5px]">点击卡面切卡试听</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    playSfx('click');
                    setDeckPage((p) => (p - 1 + totalPages) % totalPages);
                  }}
                  className="brutal-pad w-6 h-6 rounded-md bg-[#E7E1D3] flex items-center justify-center"
                >
                  <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.8} />
                </button>
                <span className="font-mono-hw text-[11px] font-bold px-1">
                  {safePage + 1}/{totalPages}
                </span>
                <button
                  onClick={() => {
                    playSfx('click');
                    setDeckPage((p) => (p + 1) % totalPages);
                  }}
                  className="brutal-pad w-6 h-6 rounded-md bg-[#E7E1D3] flex items-center justify-center"
                >
                  <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.8} />
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
                    className="rounded-xl bg-[#E7E1D3]/75 border-[2px] border-dashed border-[#17171C]/30 flex flex-col items-center justify-center gap-1 text-[#626272] hover:bg-[#E7E1D3] hover:text-[#17171C] transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 opacity-60" />
                    <span className="font-mono-hw text-[9.5px] font-bold">PULL TO UNLOCK</span>
                  </button>
                );
              }

              const slotCard = getCardById(slotCardId);
              const slotRar = RARITY_META[slotCard.rarity];
              const isCurrent = slotCard.id === selectedId;
              const frameBg =
                slotCard.rarity === 'UR' || slotCard.rarity === 'SSR'
                  ? 'holo-shine-border'
                  : slotCard.rarity === 'SR'
                    ? 'bg-gradient-to-br from-[#7C3AED] via-[#38BDF8] to-[#00D4AA]'
                    : slotCard.rarity === 'R'
                      ? 'bg-gradient-to-br from-[#E2E8F0] via-[#94A3B8] to-[#CBD5E1]'
                      : 'bg-[#DFD6C3]';

              return (
                <button
                  key={slotCard.id}
                  onClick={() => {
                    selectGachaCard(slotCard.id);
                    burstEnergyRef.current = 0.95;
                    void holoAudio.previewCard(slotCard.id);
                  }}
                  className={`relative rounded-xl p-[3px] border-[2px] border-[#17171C] overflow-hidden holo-thumb-sheen transition-all duration-150 cursor-pointer ${frameBg} ${
                    isCurrent
                      ? 'ring-2 ring-[#FF5526] shadow-[3px_3px_0px_0px_#17171C] -translate-y-0.5'
                      : 'shadow-[2px_2px_0px_0px_#17171C] hover:-translate-y-0.5'
                  }`}
                >
                  <div className="relative w-full h-full rounded-[8px] overflow-hidden border-[1.5px] border-[#17171C] bg-[#14151B]">
                    <CardArtwork artId={slotCard.artId} />
                    <span
                      className="absolute top-1 left-1 px-1 py-[0.5px] rounded text-[8.5px] font-black border border-[#17171C]"
                      style={{ backgroundColor: slotRar.bg, color: slotRar.text }}
                    >
                      {slotRar.label}
                    </span>
                    <span className="absolute top-1 right-1 px-1.5 py-[0.5px] rounded-full bg-[#FBF9F4] border border-[#17171C] font-mono-hw text-[9px] font-black text-[#17171C]">
                      {slotCard.code}
                    </span>
                    <div className="absolute bottom-0 inset-x-0 bg-[#14151B]/86 px-1.5 py-0.5 text-[9.5px] font-black text-[#FBF9F4] truncate tracking-wider">
                      {slotCard.shortTitle}
                    </div>
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
