import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { holoAudio } from '../audio/HoloAudioEngine';
import { useHoloSfx } from '../audio/useHoloSfx';
import { CardArtwork } from '../components/artwork/CardArtwork';
import { HoloCard } from '../components/holo/HoloCard';
import { CATEGORY_META, RARITY_META, getCardById } from '../data/soundCards';
import { useHoloStore } from '../store/useHoloStore';
import { fireHoloConfetti } from '../utils/confetti';

export const GachaPage: React.FC = () => {
  const selectedId = useHoloStore((s) => s.selectedGachaCardId);
  const needsScratch = useHoloStore((s) => s.needsScratch);
  const pityCount = useHoloStore((s) => s.pityCount);
  const pullHistory = useHoloStore((s) => s.pullHistory);
  const collection = useHoloStore((s) => s.collection);
  const pullGachaCard = useHoloStore((s) => s.pullGachaCard);
  const revealCurrentCard = useHoloStore((s) => s.revealCurrentCard);
  const selectGachaCard = useHoloStore((s) => s.selectGachaCard);
  const sendCardToBeat = useHoloStore((s) => s.sendCardToBeat);
  const pushToast = useHoloStore((s) => s.pushToast);

  const playSfx = useHoloSfx();
  const card = getCardById(selectedId);
  const catInfo = CATEGORY_META[card.category];
  const rarInfo = RARITY_META[card.rarity];

  const [flipped, setFlipped] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [capsuleBounce, setCapsuleBounce] = useState(false);
  const [cardPopKey, setCardPopKey] = useState(0);
  const [leverAngle, setLeverAngle] = useState(0); // 0..68 deg downward
  const [deckPage, setDeckPage] = useState(0);

  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const burstEnergyRef = useRef(0);
  const leverDragRef = useRef<{ startY: number; triggered: boolean } | null>(null);

  // Reset flip when switching card
  useEffect(() => {
    setFlipped(false);
  }, [selectedId]);

  // Live OLED Waveform Visualizer on top-right panel
  useEffect(() => {
    let raf = 0;
    const draw = (t: number) => {
      const canvas = waveCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.fillStyle = '#181820';
          ctx.fillRect(0, 0, w, h);

          const waveData = holoAudio.getWaveformData();
          const meter = holoAudio.getMeterLevel();
          burstEnergyRef.current = Math.max(0, burstEnergyRef.current * 0.94);
          const energy = Math.max(meter, burstEnergyRef.current);

          const barCount = 34;
          const gap = 3;
          const barW = (w - 16 - gap * (barCount - 1)) / barCount;

          for (let i = 0; i < barCount; i++) {
            const sampleIdx = Math.floor((i / barCount) * waveData.length);
            const raw = Math.abs(waveData[sampleIdx] ?? 0);
            // Iconic symmetrical orange spike silhouette matching Mockup 1!
            const centerEnv = Math.sin((i / (barCount - 1)) * Math.PI);
            const harmonic = Math.abs(Math.sin(i * 0.72 + t * 0.0055)) * 0.55 + 0.45;
            const idleH = (0.14 + centerEnv * harmonic * 0.62) * (0.65 + energy * 0.85);
            const liveH = Math.min(0.95, raw * 3.8 + idleH);
            const bh = Math.max(4, liveH * (h - 14));
            const x = 8 + i * (barW + gap);
            const y = (h - bh) / 2;

            ctx.fillStyle = i % 3 === 0 ? '#FFD60A' : '#FF5C2B';
            ctx.shadowColor = '#FF5C2B';
            ctx.shadowBlur = energy > 0.15 ? 8 : 3;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, bh, 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const triggerShake = () => {
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
    window.setTimeout(() => setShaking(false), 380);
  };

  const handlePull = (skipScratch = false) => {
    // If Quick Unbox clicked while current card is still covered in scratch coating -> reveal it immediately!
    if (skipScratch && needsScratch) {
      handleReveal(card.id);
      return;
    }

    playSfx('ratchet');
    triggerShake();
    setFlipped(false);
    setLeverAngle(64);
    window.setTimeout(() => setLeverAngle(0), 340);

    window.setTimeout(() => {
      playSfx('capsuleDrop');
      const { card: pulled, isNew, hitPity } = pullGachaCard(skipScratch);
      setCardPopKey((k) => k + 1);
      setDeckPage(0);

      if (skipScratch) {
        triggerRevealCelebration(pulled.id, pulled.rarity, isNew, hitPity);
      } else {
        pushToast({
          text: hitPity
            ? `✨ 保底触发！刮开银色全息涂层揭晓高稀有度声卡！`
            : `🎁 新盲盒声卡已出炉！按住刮开涂层或点击 QUICK UNBOX`,
          accent: '#7C3AED',
        });
      }
    }, 170);
  };

  const triggerRevealCelebration = (
    cardId: string,
    rarity: string,
    isNew?: boolean,
    hitPity?: boolean
  ) => {
    const revealed = getCardById(cardId);
    const isHigh = rarity === 'SSR' || rarity === 'UR';
    if (isHigh || rarity === 'SR') {
      playSfx('holoFanfare');
    }
    fireHoloConfetti(isHigh ? 'high' : 'normal');
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

  // Recent Deck 2x3 paginated cards (shows pulled history / unlocked collection)
  const orderedDeck = [
    ...pullHistory.filter((id) => collection.includes(id)),
    ...collection.filter((id) => !pullHistory.includes(id)),
  ];
  const totalPages = Math.max(1, Math.ceil(orderedDeck.length / 6));
  const safePage = Math.min(deckPage, totalPages - 1);
  const visibleSlice = orderedDeck.slice(safePage * 6, safePage * 6 + 6);
  const deckSlots = Array.from({ length: 6 }, (_, i) => visibleSlice[i] ?? null);

  return (
    <div className="w-full h-full p-3.5 grid grid-cols-[minmax(285px,31%)_1fr_minmax(265px,27%)] gap-4 overflow-hidden">
      {/* ================= LEFT COLUMN: HOLO GACHA MACHINE ================= */}
      <section className="relative flex items-stretch justify-center pr-5 min-h-0">
        {/* Main Yellow Toy Machine Chassis */}
        <div
          className={`relative flex-1 bg-[#FFD60A] border-[3.5px] border-[#1A1A1F] rounded-[24px] shadow-[6px_6px_0px_0px_#1A1A1F] p-3.5 flex flex-col justify-between gap-2.5 ${
            shaking ? 'animate-gacha-shake' : ''
          }`}
        >
          {/* Decorative Machine Stand Feet */}
          <div className="absolute -bottom-[11px] left-5 w-14 h-3 rounded-b-lg bg-[#94A3B8] border-[3px] border-[#1A1A1F]" />
          <div className="absolute -bottom-[11px] right-5 w-14 h-3 rounded-b-lg bg-[#94A3B8] border-[3px] border-[#1A1A1F]" />

          {/* Top Riveted Nameplate */}
          <div className="relative bg-[#FFFDF8] border-[3px] border-[#1A1A1F] rounded-2xl py-2 px-4 shadow-[0_3px_0_#1A1A1F] flex items-center justify-center shrink-0">
            <span className="absolute left-2.5 top-2 w-1.5 h-1.5 rounded-full bg-[#1A1A1F]" />
            <span className="absolute right-2.5 top-2 w-1.5 h-1.5 rounded-full bg-[#1A1A1F]" />
            <span className="absolute left-2.5 bottom-2 w-1.5 h-1.5 rounded-full bg-[#1A1A1F]" />
            <span className="absolute right-2.5 bottom-2 w-1.5 h-1.5 rounded-full bg-[#1A1A1F]" />
            <h1 className="text-[22px] font-black tracking-wide text-[#1A1A1F] leading-none">
              HOLO GACHA
            </h1>
          </div>

          {/* Transparent Capsule & Foil Pack Showcase Window (Clickable Easter Egg!) */}
          <div
            onClick={() => {
              playSfx('capsuleDrop');
              setCapsuleBounce(true);
              window.setTimeout(() => setCapsuleBounce(false), 400);
            }}
            title="点击橱窗摇晃扭蛋与全息卡包！"
            className="relative flex-1 min-h-[175px] rounded-[18px] border-[3.5px] border-[#1A1A1F] bg-gradient-to-b from-[#3A3447] via-[#262230] to-[#1A1722] overflow-hidden cursor-pointer shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)] group"
          >
            {/* Inside Toy Capsules + Mini Peeking Holo Card Packs */}
            <svg
              viewBox="0 0 260 220"
              className={`w-full h-full transition-transform duration-300 ${
                capsuleBounce ? 'scale-105 -rotate-2' : 'group-hover:scale-[1.02]'
              }`}
            >
              {/* Back-row capsules */}
              <g opacity="0.85">
                <circle cx="58" cy="82" r="34" fill="#FF3D9A" stroke="#1A1A1F" strokeWidth="3.5" />
                <path d="M24 82 A34 34 0 0 1 92 82 Z" fill="#FFFDF8" opacity="0.55" />
                <circle cx="118" cy="64" r="32" fill="#00D4AA" stroke="#1A1A1F" strokeWidth="3.5" />
                <path d="M86 64 A32 32 0 0 1 150 64 Z" fill="#FFFDF8" opacity="0.5" />
                <circle cx="206" cy="118" r="36" fill="#FF5C2B" stroke="#1A1A1F" strokeWidth="3.5" />
                <path d="M170 118 A36 36 0 0 1 242 118 Z" fill="#FFFDF8" opacity="0.5" />
              </g>

              {/* Peeking Silver Holographic Card Pack #1 (Top Right) */}
              <g transform="translate(154, 24) rotate(14)">
                <rect x="0" y="0" width="56" height="84" rx="6" fill="url(#pack-holo)" stroke="#1A1A1F" strokeWidth="3.5" />
                <path d="M28 24 L33 37 L46 42 L33 47 L28 60 L23 47 L10 42 L23 37 Z" fill="#FFFDF8" stroke="#1A1A1F" strokeWidth="2.5" />
              </g>

              {/* Mid-row vibrant capsules */}
              <g>
                <circle cx="106" cy="116" r="38" fill="#7C3AED" stroke="#1A1A1F" strokeWidth="4" />
                <path d="M68 116 A38 38 0 0 1 144 116 Z" fill="#E9D5FF" opacity="0.55" />
                <line x1="68" y1="116" x2="144" y2="116" stroke="#1A1A1F" strokeWidth="3" />

                <circle cx="156" cy="144" r="38" fill="#00D4AA" stroke="#1A1A1F" strokeWidth="4" />
                <path d="M118 144 A38 38 0 0 1 194 144 Z" fill="#CCFBF1" opacity="0.55" />
                <line x1="118" y1="144" x2="194" y2="144" stroke="#1A1A1F" strokeWidth="3" />
              </g>

              {/* Peeking Silver Holographic Card Pack #2 (Left) */}
              <g transform="translate(18, 92) rotate(-14)">
                <rect x="0" y="0" width="58" height="86" rx="6" fill="url(#pack-holo)" stroke="#1A1A1F" strokeWidth="3.5" />
                <path d="M29 25 L34 38 L47 43 L34 48 L29 61 L24 48 L11 43 L24 38 Z" fill="#FFFDF8" stroke="#1A1A1F" strokeWidth="2.5" />
              </g>

              {/* Peeking Silver Holographic Card Pack #3 (Right) */}
              <g transform="translate(184, 128) rotate(12)">
                <rect x="0" y="0" width="58" height="86" rx="6" fill="url(#pack-holo)" stroke="#1A1A1F" strokeWidth="3.5" />
                <path d="M29 25 L34 38 L47 43 L34 48 L29 61 L24 48 L11 43 L24 38 Z" fill="#FFFDF8" stroke="#1A1A1F" strokeWidth="2.5" />
              </g>

              {/* Front bottom capsules */}
              <g>
                <circle cx="116" cy="192" r="42" fill="#FF5C2B" stroke="#1A1A1F" strokeWidth="4" />
                <path d="M74 192 A42 42 0 0 1 158 192 Z" fill="#FFFDF8" opacity="0.55" />
                <line x1="74" y1="192" x2="158" y2="192" stroke="#1A1A1F" strokeWidth="3" />

                <circle cx="182" cy="206" r="36" fill="#FFD60A" stroke="#1A1A1F" strokeWidth="4" />
                <path d="M146 206 A36 36 0 0 1 218 206 Z" fill="#FFFDF8" opacity="0.5" />
              </g>

              <defs>
                <linearGradient id="pack-holo" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="32%" stopColor="#E2E8F0" />
                  <stop offset="56%" stopColor="#FF3D9A" />
                  <stop offset="80%" stopColor="#FFD60A" />
                  <stop offset="100%" stopColor="#00D4AA" />
                </linearGradient>
              </defs>
            </svg>

            {/* Glossy Diagonal Glass Reflections */}
            <div className="absolute -top-6 -left-10 w-24 h-[140%] bg-white/18 rotate-[24deg] pointer-events-none" />
            <div className="absolute -top-6 left-12 w-7 h-[140%] bg-white/12 rotate-[24deg] pointer-events-none" />
          </div>

          {/* Bottom Control Cluster */}
          <div className="flex flex-col gap-2 shrink-0">
            {/* Primary Oversized Persimmon Orange PULL CARD CTA */}
            <div className="relative px-1.5">
              <span className="absolute left-0 top-1 w-2 h-2 rounded-full bg-[#1A1A1F]/40 border border-[#1A1A1F]" />
              <span className="absolute right-0 top-1 w-2 h-2 rounded-full bg-[#1A1A1F]/40 border border-[#1A1A1F]" />
              <button
                onClick={() => handlePull(false)}
                className="brutal-btn-lg w-full py-3 rounded-[16px] bg-[#FF5C2B] text-[#1A1A1F] text-[22px] font-black tracking-wide uppercase flex items-center justify-center"
              >
                PULL CARD
              </button>
            </div>

            {/* Secondary Mint Cyan QUICK UNBOX Button */}
            <div className="px-5">
              <button
                onClick={() => handlePull(true)}
                className="brutal-btn w-full py-1.5 rounded-full bg-[#00D4AA] text-[#1A1A1F] text-sm font-black tracking-wider uppercase"
              >
                {needsScratch ? 'QUICK UNBOX · 立即刮开' : 'QUICK UNBOX'}
              </button>
            </div>

            {/* SSR PITY 4/5 Segmented Bar */}
            <div className="bg-[#FFFDF8] border-[2.5px] border-[#1A1A1F] rounded-2xl px-3 py-2 flex items-center justify-between gap-2.5">
              <span className="font-mono-hw text-xs font-black text-[#1A1A1F] whitespace-nowrap">
                SSR PITY {pityCount}/5
              </span>
              <div className="flex-1 h-4 rounded-full bg-[#EDE7D9] border-[2px] border-[#1A1A1F] p-[2px] grid grid-cols-5 gap-[2px]">
                {[0, 1, 2, 3, 4].map((seg) => (
                  <div
                    key={seg}
                    className={`h-full rounded-sm transition-colors duration-200 ${
                      seg < pityCount
                        ? 'bg-[#7C3AED] border border-[#1A1A1F]/40'
                        : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Physical Mechanical Pull Lever Mounted on Right Edge of Machine */}
        <div
          title="点击或向下拖拽拉杆抽卡！"
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
            if (nextAngle >= 46) {
              leverDragRef.current.triggered = true;
              handlePull(false);
            }
          }}
          onPointerUp={() => {
            if (leverDragRef.current && !leverDragRef.current.triggered) {
              // Quick tap/click also pulls!
              handlePull(false);
            }
            leverDragRef.current = null;
            window.setTimeout(() => setLeverAngle(0), 220);
          }}
          onPointerCancel={() => {
            leverDragRef.current = null;
            setLeverAngle(0);
          }}
          className="absolute right-0 top-[33%] w-9 h-36 flex items-center justify-start cursor-grab active:cursor-grabbing select-none z-20"
        >
          {/* Metallic Wall Bracket */}
          <div className="w-4 h-24 rounded-r-xl bg-gradient-to-b from-[#E2E8F0] via-[#94A3B8] to-[#64748B] border-[3px] border-l-0 border-[#1A1A1F] shadow-[3px_3px_0px_0px_#1A1A1F] flex items-center justify-center">
            <div className="w-1.5 h-12 rounded-full bg-[#181820]" />
          </div>

          {/* Pivoting Chrome Arm + Persimmon Orange Ball Knob */}
          <div
            style={{
              transformOrigin: '4px 90%',
              transform: `rotate(${leverAngle}deg)`,
            }}
            className="absolute left-0.5 -top-8 w-8 h-28 transition-transform duration-150 pointer-events-none flex flex-col items-center"
          >
            {/* Glossy Orange Handle Ball */}
            <div className="relative w-10 h-10 -ml-1 rounded-full bg-[#FF5C2B] border-[3px] border-[#1A1A1F] shadow-[2px_3px_0px_0px_#1A1A1F]">
              <div className="absolute top-1.5 left-2 w-3 h-2 rounded-full bg-white/65 -rotate-25" />
            </div>
            {/* Chrome Shaft */}
            <div className="w-3 flex-1 bg-gradient-to-r from-[#F8FAFC] via-[#CBD5E1] to-[#64748B] border-x-[2.5px] border-b-[2.5px] border-[#1A1A1F] rounded-b-full -mt-1" />
          </div>
        </div>
      </section>

      {/* ================= CENTER STAGE: HERO 3D HOLOGRAPHIC CARD VAULT ================= */}
      <section className="brutal-oled relative flex flex-col items-center justify-between p-4 overflow-hidden min-h-0">
        {/* Corner Technical Crosshairs (+) */}
        <span className="absolute top-3 left-3.5 text-white/45 font-mono-hw text-lg leading-none pointer-events-none">
          +
        </span>
        <span className="absolute top-3 right-3.5 text-white/45 font-mono-hw text-lg leading-none pointer-events-none">
          +
        </span>
        <span className="absolute bottom-[74px] left-3.5 text-white/45 font-mono-hw text-lg leading-none pointer-events-none">
          +
        </span>
        <span className="absolute bottom-[74px] right-3.5 text-white/45 font-mono-hw text-lg leading-none pointer-events-none">
          +
        </span>

        {/* Floating Neo-Brutalist Vector Confetti Accents Behind Card (1:1 Mockup 1!) */}
        <svg
          viewBox="0 0 460 440"
          className="absolute inset-0 w-full h-full pointer-events-none opacity-90"
        >
          {/* Left Side Accents */}
          <path d="M40 102 L45 112 L55 115 L45 118 L40 128 L35 118 L25 115 L35 112 Z" fill="#FFD60A" />
          <g transform="translate(22, 175) rotate(-14)">
            <path d="M12 24 V4 L26 2 V18" fill="none" stroke="#FF3D9A" strokeWidth="4" strokeLinecap="round" />
            <circle cx="8" cy="24" r="5" fill="#FF3D9A" />
            <circle cx="22" cy="18" r="5" fill="#FF3D9A" />
          </g>
          <path d="M26 270 L46 266 M28 282 L44 282 M32 294 L46 298" stroke="#FFD60A" strokeWidth="3.5" strokeLinecap="round" />

          {/* Right Side Accents */}
          <path d="M420 96 L424 103 L431 105 L424 107 L420 114 L416 107 L409 105 L416 103 Z" fill="#FFD60A" />
          <g transform="translate(405, 160) rotate(10)">
            <path d="M8 22 V4 L24 2 V17" fill="none" stroke="#00D4AA" strokeWidth="4" strokeLinecap="round" />
            <circle cx="4" cy="22" r="5" fill="#00D4AA" />
            <circle cx="20" cy="17" r="5" fill="#00D4AA" />
          </g>
          <path d="M412 252 L430 242 M416 264 L434 264 M414 276 L430 286" stroke="#FF5C2B" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M424 318 L428 328 L438 331 L428 334 L424 344 L420 334 L410 331 L420 328 Z" fill="#FFD60A" />
        </svg>

        {/* Center 3D Holographic Showcase Card */}
        <div className="flex-1 flex items-center justify-center w-full min-h-0 relative z-10">
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
              synthFormula={card.synthFormula}
              recommendedBpm={card.recommendedBpm}
              stats={card.stats}
              flipped={flipped}
              needsScratch={needsScratch}
              onScratchReveal={() => handleReveal(card.id)}
              width={318}
              height={446}
            />
          </div>
        </div>

        {/* Bottom 3 Action Buttons Row */}
        <div className="w-full grid grid-cols-3 gap-2.5 pt-3 relative z-10 shrink-0">
          <button
            onClick={handlePreviewSound}
            className="brutal-btn py-2.5 px-2 rounded-xl bg-[#00D4AA] text-[#1A1A1F] text-[13px] font-black tracking-wide uppercase"
          >
            PLAY SOUND
          </button>
          <button
            onClick={() => {
              playSfx('cartridgeLock');
              sendCardToBeat(card.id);
            }}
            className="brutal-btn py-2.5 px-2 rounded-xl bg-[#7C3AED] text-white text-[13px] font-black tracking-wide uppercase"
          >
            SEND TO BEAT
          </button>
          <button
            onClick={() => {
              playSfx('click', 0.8);
              setFlipped((f) => !f);
            }}
            className="brutal-btn py-2.5 px-2 rounded-xl bg-[#FFFDF8] text-[#1A1A1F] text-[13px] font-black tracking-wide uppercase"
          >
            {flipped ? 'SHOW FRONT' : 'FLIP INFO'}
          </button>
        </div>
      </section>

      {/* ================= RIGHT COLUMN: SPECS & RECENT DECK ================= */}
      <section className="flex flex-col gap-3.5 min-h-0">
        {/* Top Panel: Rarity Badge, Live OLED Waveform & PUNCH/SHINE/VIBE Bars */}
        <div className="brutal-panel p-3.5 flex flex-col gap-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className="px-3 py-1 rounded-full border-[2.5px] border-[#1A1A1F] font-mono-hw text-xs font-black tracking-wider shadow-[2px_2px_0px_0px_#1A1A1F]"
              style={{ backgroundColor: rarInfo.bg, color: rarInfo.text }}
            >
              {rarInfo.label} · {catInfo.label}
            </span>
            <span className="text-xs font-extrabold text-[#5C5C6B] truncate">
              {card.zhTitle}
            </span>
          </div>

          {/* Dark OLED Waveform Window */}
          <div
            onClick={handlePreviewSound}
            title="点击试听该声卡音频"
            className="w-full h-[76px] rounded-xl bg-[#181820] border-[2.5px] border-[#1A1A1F] overflow-hidden cursor-pointer"
          >
            <canvas ref={waveCanvasRef} width={280} height={76} className="w-full h-full block" />
          </div>

          {/* 3 Stat Spec Bars: PUNCH / SHINE / VIBE */}
          <div className="flex flex-col gap-2 pt-0.5">
            {[
              { label: 'PUNCH', val: card.stats.punch, color: '#FF5C2B' },
              { label: 'SHINE', val: card.stats.shine, color: '#FFD60A' },
              { label: 'VIBE', val: card.stats.vibe, color: '#7C3AED' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className="w-[62px] py-0.5 text-center rounded-full bg-[#FFFDF8] border-[2px] border-[#1A1A1F] font-mono-hw text-[10px] font-black text-[#1A1A1F] shrink-0">
                  {stat.label}
                </span>
                <div className="flex-1 h-4 rounded-full bg-[#EDE7D9] border-[2px] border-[#1A1A1F] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 border-r-[2px] border-[#1A1A1F]"
                    style={{
                      width: `${stat.val}%`,
                      backgroundColor: stat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Panel: RECENT DECK 2x3 Miniature Holo Cards */}
        <div className="brutal-panel p-3.5 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2.5 shrink-0">
            <h2 className="text-[16px] font-black tracking-wide uppercase text-[#1A1A1F]">
              RECENT DECK
            </h2>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    playSfx('click');
                    setDeckPage((p) => (p - 1 + totalPages) % totalPages);
                  }}
                  className="brutal-pad w-6 h-6 rounded-md bg-[#EDE7D9] flex items-center justify-center"
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
                  className="brutal-pad w-6 h-6 rounded-md bg-[#EDE7D9] flex items-center justify-center"
                >
                  <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.8} />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 grid grid-cols-2 grid-rows-3 gap-2.5 min-h-0">
            {deckSlots.map((slotCardId, idx) => {
              if (!slotCardId) {
                return (
                  <button
                    key={`empty-${idx}`}
                    onClick={() => handlePull(false)}
                    className="rounded-xl bg-[#EDE7D9] border-[2px] border-dashed border-[#1A1A1F]/40 flex flex-col items-center justify-center gap-1 text-[#5C5C6B] hover:bg-[#E5DEC9] transition-colors cursor-pointer"
                  >
                    <Lock className="w-4 h-4 opacity-50" />
                    <span className="font-mono-hw text-[10px] font-bold">PULL TO UNLOCK</span>
                  </button>
                );
              }

              const slotCard = getCardById(slotCardId);
              const isCurrent = slotCard.id === selectedId;

              return (
                <button
                  key={slotCard.id}
                  onClick={() => {
                    selectGachaCard(slotCard.id);
                    burstEnergyRef.current = 0.95;
                    void holoAudio.previewCard(slotCard.id);
                  }}
                  className={`relative rounded-xl p-[3px] border-[2.5px] border-[#1A1A1F] overflow-hidden holo-thumb-sheen transition-transform cursor-pointer ${
                    isCurrent
                      ? 'holo-shine-border shadow-[3px_3px_0px_0px_#1A1A1F] -translate-y-0.5'
                      : 'bg-gradient-to-br from-[#38BDF8] via-[#FFD60A] to-[#FF3D9A] shadow-[2px_2px_0px_0px_#1A1A1F] hover:-translate-y-0.5'
                  }`}
                >
                  <div className="relative w-full h-full rounded-[8px] overflow-hidden border-[1.5px] border-[#1A1A1F] bg-[#181820]">
                    <CardArtwork artId={slotCard.artId} />
                    <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full bg-[#FFFDF8] border-[1.5px] border-[#1A1A1F] font-mono-hw text-[10px] font-black text-[#1A1A1F]">
                      {slotCard.code}
                    </span>
                    <div className="absolute bottom-0 inset-x-0 bg-[#181820]/82 px-1.5 py-0.5 text-[9px] font-black text-[#FFFDF8] truncate tracking-wider">
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
