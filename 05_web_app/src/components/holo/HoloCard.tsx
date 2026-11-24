import React, { useEffect, useId, useRef, useState } from 'react';
import { RotateCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { CATEGORY_META, HOLO_FOIL_LIST, RARITY_META } from '../../data/soundCards';
import { getStickerById } from '../../data/stickers';
import type { HoloFoilType, PlacedSticker, Rarity, TrackCategory } from '../../types/holo';
import { CardArtwork } from '../artwork/CardArtwork';
import { ScratchOverlay } from './ScratchOverlay';

export interface HoloCardProps {
  title: string;
  zhTitle?: string;
  code: string;
  rarity: Rarity;
  category?: TrackCategory;
  specLabel?: string;
  foil: HoloFoilType;
  artId: string;
  storyZh?: string;
  synthFormula?: string;
  recommendedBpm?: number;
  stats?: { punch: number; shine: number; vibe: number };
  flipped?: boolean;
  needsScratch?: boolean;
  onScratchReveal?: () => void;
  waveformBars?: number[];
  waveformActive?: boolean;
  stickers?: PlacedSticker[];
  editableStickers?: boolean;
  onUpdateSticker?: (uid: string, patch: Partial<PlacedSticker>) => void;
  onRemoveSticker?: (uid: string) => void;
  showAura?: boolean;
  idleShimmer?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

const RARITY_FOIL_INTENSITY: Record<Rarity, number> = {
  N: 0.14,
  R: 0.3,
  SR: 0.56,
  SSR: 0.78,
  UR: 0.96,
  LTD: 0.88,
};

const RARITY_TILT_MAX: Record<Rarity, number> = {
  N: 9,
  R: 11,
  SR: 13,
  SSR: 15,
  UR: 16.5,
  LTD: 15.5,
};

export const HoloCard: React.FC<HoloCardProps> = ({
  title,
  zhTitle,
  code,
  rarity,
  category = 'PERC',
  specLabel,
  foil,
  artId,
  storyZh,
  synthFormula,
  recommendedBpm = 120,
  stats,
  flipped = false,
  needsScratch = false,
  onScratchReveal,
  waveformBars,
  waveformActive = false,
  stickers = [],
  editableStickers = false,
  onUpdateSticker,
  onRemoveSticker,
  showAura = true,
  idleShimmer = true,
  width = 278,
  height = 388,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const shellRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const hoveringRef = useRef(false);

  // Hooke's Law Damped Spring State (position + velocity)
  const springRef = useRef({
    rx: 0, vrx: 0,
    ry: 0, vry: 0,
    px: 0, vpx: 0,
    py: 0, vpy: 0,
    gx: 50, vgx: 0,
    gy: 50, vgy: 0,
    sc: 1, vsc: 0,
  });
  const targetRef = useRef({ rx: 0, ry: 0, px: 0, py: 0, gx: 50, gy: 50, sc: 1 });

  const [selectedStickerUid, setSelectedStickerUid] = useState<string | null>(null);
  const dragStickerRef = useRef<{
    uid: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const isHighTier = rarity === 'SSR' || rarity === 'UR' || rarity === 'LTD';
  const foilMeta = HOLO_FOIL_LIST.find((f) => f.id === foil) ?? HOLO_FOIL_LIST[0];
  const foilIntensity = RARITY_FOIL_INTENSITY[rarity];

  const sparkleMode: 'none' | 'soft' | 'strong' =
    rarity === 'UR' || (foil === 'spark' && rarity !== 'N')
      ? 'strong'
      : rarity === 'SSR' || rarity === 'LTD'
        ? 'soft'
        : 'none';

  // Apply spring values straight to CSS variables (zero React re-renders!)
  const applyCssVars = (el: HTMLDivElement, s: typeof springRef.current) => {
    const hyp = Math.min(1, Math.hypot(s.px, s.py));
    const shadowX = (-s.ry * 1.15).toFixed(1);
    const shadowY = (16 + s.rx * 0.95).toFixed(1);

    el.style.setProperty('--rotate-x', `${s.rx.toFixed(2)}deg`);
    el.style.setProperty('--rotate-y', `${s.ry.toFixed(2)}deg`);
    el.style.setProperty('--px', s.px.toFixed(3));
    el.style.setProperty('--py', s.py.toFixed(3));
    el.style.setProperty('--hyp', hyp.toFixed(3));
    el.style.setProperty('--scale', s.sc.toFixed(4));
    el.style.setProperty('--pointer-x', `${s.gx.toFixed(1)}%`);
    el.style.setProperty('--pointer-y', `${s.gy.toFixed(1)}%`);
    el.style.setProperty('--bg-x', `${(100 - s.gx).toFixed(1)}%`);
    el.style.setProperty('--bg-y', `${(100 - s.gy).toFixed(1)}%`);
    el.style.setProperty('--bg-x2', `${(s.gx * 1.2 - 10).toFixed(1)}%`);
    el.style.setProperty('--bg-y2', `${(s.gy * 1.2 - 10).toFixed(1)}%`);
    el.style.setProperty('--shadow-x', `${shadowX}px`);
    el.style.setProperty('--shadow-y', `${shadowY}px`);
    el.style.setProperty('--foil-intensity', String(foilIntensity));
  };

  // Spring-Physics + Ambient Museum-Spotlight Idle Loop
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const stepSpring = (
      val: number,
      vel: number,
      target: number,
      k: number,
      d: number
    ): [number, number] => {
      const acc = (target - val) * k;
      const nextVel = (vel + acc) * d;
      return [val + nextVel, nextVel];
    };

    const startLoop = () => {
      if (rafRef.current !== null) return;
      const tick = (now: number) => {
        const el = shellRef.current;
        if (!el) {
          rafRef.current = null;
          return;
        }

        const s = springRef.current;
        const t = targetRef.current;

        // Subtle museum spotlight ambient figure-8 shimmer when idle on SR+ cards
        if (!hoveringRef.current && idleShimmer && !prefersReduced && !needsScratch && rarity !== 'N') {
          const amp = rarity === 'UR' ? 1 : rarity === 'SSR' || rarity === 'LTD' ? 0.85 : 0.45;
          const phase = now * 0.00095;
          const ix = Math.sin(phase) * 0.34 * amp;
          const iy = Math.sin(phase * 1.65) * 0.24 * amp;
          t.rx = -iy * 6.5;
          t.ry = ix * 7.5;
          t.px = ix;
          t.py = iy;
          t.gx = 50 + ix * 55;
          t.gy = 50 + iy * 55;
          t.sc = 1;
        }

        const k = hoveringRef.current ? 0.19 : 0.11;
        const d = hoveringRef.current ? 0.72 : 0.76;

        [s.rx, s.vrx] = stepSpring(s.rx, s.vrx, t.rx, k, d);
        [s.ry, s.vry] = stepSpring(s.ry, s.vry, t.ry, k, d);
        [s.px, s.vpx] = stepSpring(s.px, s.vpx, t.px, k, d);
        [s.py, s.vpy] = stepSpring(s.py, s.vpy, t.py, k, d);
        [s.gx, s.vgx] = stepSpring(s.gx, s.vgx, t.gx, k, d);
        [s.gy, s.vgy] = stepSpring(s.gy, s.vgy, t.gy, k, d);
        [s.sc, s.vsc] = stepSpring(s.sc, s.vsc, t.sc, 0.17, 0.72);

        applyCssVars(el, s);

        const keepAmbient = idleShimmer && !prefersReduced && !needsScratch && rarity !== 'N';
        const settled =
          !hoveringRef.current &&
          !keepAmbient &&
          Math.abs(s.rx - t.rx) < 0.04 &&
          Math.abs(s.ry - t.ry) < 0.04 &&
          Math.abs(s.vrx) < 0.02 &&
          Math.abs(s.vry) < 0.02 &&
          Math.abs(s.sc - 1) < 0.001;

        if (settled) {
          el.classList.remove('holo-active');
          rafRef.current = null;
        } else {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    if (shellRef.current) {
      shellRef.current.style.setProperty('--foil-intensity', String(foilIntensity));
    }

    if (idleShimmer && !prefersReduced && !needsScratch && rarity !== 'N') {
      startLoop();
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rarity, foilIntensity, idleShimmer, needsScratch]);

  const ensureSpringRunning = () => {
    if (rafRef.current !== null) return;
    const stepSpring = (
      val: number,
      vel: number,
      target: number,
      k: number,
      d: number
    ): [number, number] => {
      const acc = (target - val) * k;
      const nextVel = (vel + acc) * d;
      return [val + nextVel, nextVel];
    };
    const tick = () => {
      const el = shellRef.current;
      if (!el) {
        rafRef.current = null;
        return;
      }
      const s = springRef.current;
      const t = targetRef.current;
      const k = hoveringRef.current ? 0.19 : 0.11;
      const d = hoveringRef.current ? 0.72 : 0.76;

      [s.rx, s.vrx] = stepSpring(s.rx, s.vrx, t.rx, k, d);
      [s.ry, s.vry] = stepSpring(s.ry, s.vry, t.ry, k, d);
      [s.px, s.vpx] = stepSpring(s.px, s.vpx, t.px, k, d);
      [s.py, s.vpy] = stepSpring(s.py, s.vpy, t.py, k, d);
      [s.gx, s.vgx] = stepSpring(s.gx, s.vgx, t.gx, k, d);
      [s.gy, s.vgy] = stepSpring(s.gy, s.vgy, t.gy, k, d);
      [s.sc, s.vsc] = stepSpring(s.sc, s.vsc, t.sc, 0.17, 0.72);

      applyCssVars(el, s);

      const settled =
        !hoveringRef.current &&
        Math.abs(s.rx - t.rx) < 0.04 &&
        Math.abs(s.ry - t.ry) < 0.04 &&
        Math.abs(s.vrx) < 0.02 &&
        Math.abs(s.vry) < 0.02 &&
        Math.abs(s.sc - 1) < 0.001;

      if (settled) {
        el.classList.remove('holo-active');
        rafRef.current = null;
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStickerRef.current || needsScratch) return;
    const el = shellRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const px = (nx - 0.5) * 2;
    const py = (ny - 0.5) * 2;
    const maxTilt = RARITY_TILT_MAX[rarity];

    hoveringRef.current = true;
    el.classList.add('holo-active');
    targetRef.current = {
      rx: -py * maxTilt,
      ry: px * (maxTilt + 1.5),
      px,
      py,
      gx: nx * 100,
      gy: ny * 100,
      sc: 1.028,
    };
    ensureSpringRunning();
  };

  const handlePointerLeave = () => {
    hoveringRef.current = false;
    targetRef.current = { rx: 0, ry: 0, px: 0, py: 0, gx: 50, gy: 50, sc: 1 };
    ensureSpringRunning();
  };

  const rarityInfo = RARITY_META[rarity];
  const catInfo = CATEGORY_META[category];

  const badgeLabel =
    rarity === 'UR'
      ? '✦ UR'
      : rarity === 'SSR'
        ? '★ SSR'
        : rarity === 'LTD'
          ? '◆ LTD'
          : rarityInfo.label;

  return (
    <div
      className={`holo-scene select-none ${className}`}
      style={{ width, height }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={() => {
        if (selectedStickerUid) setSelectedStickerUid(null);
      }}
    >
      {/* Ambient Stage Spotlight Halo for SR / SSR / UR / LTD */}
      {showAura && <div className="holo-stage-aura" data-rarity={rarity} />}

      <div
        ref={shellRef}
        className={`holo-card-shell w-full h-full ${flipped ? 'holo-flipped' : ''}`}
      >
        {/* ================= FRONT FACE ================= */}
        <div
          className="holo-face holo-card-frame"
          data-rarity={rarity}
          data-foil={foil}
        >
          <div className="relative w-full h-full rounded-[11px] overflow-hidden border-[2px] border-[#17171C] bg-[#14151B] flex flex-col">
            {/* Layer 1: 3-Layer Parallax Vector Street-Toy Mascot */}
            <div className="relative flex-1 overflow-hidden">
              <CardArtwork artId={artId} parallax />

              {/* Subtle Vignette Depth Frame inside Art Box */}
              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  boxShadow: 'inset 0 0 22px rgba(20, 21, 27, 0.28)',
                }}
              />

              {/* Top-Left Tiered Collector Rarity Badge */}
              <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
                <div
                  className={`relative px-2.5 py-0.5 font-black tracking-tight border-[2px] border-[#17171C] shadow-[2.5px_2.5px_0px_0px_#17171C] rounded-[7px] ${
                    rarity === 'UR' || rarity === 'SSR'
                      ? 'text-[15px] -rotate-6'
                      : rarity === 'LTD'
                        ? 'text-[13px] -rotate-3 ring-1 ring-[#FFD426]/70'
                        : rarity === 'SR'
                          ? 'text-[14px] -rotate-4'
                          : 'text-[12px] rotate-0'
                  }`}
                  style={{
                    backgroundColor: rarityInfo.bg,
                    color: rarityInfo.text,
                  }}
                >
                  {badgeLabel}
                </div>
              </div>

              {/* Top-Right Precision Serial Number Pill */}
              <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none flex items-center gap-1">
                <div className="px-2 py-0.5 rounded-full bg-[#FBF9F4]/95 border-[2px] border-[#17171C] shadow-[2px_2px_0px_0px_#17171C] font-mono-hw text-[11px] font-black text-[#17171C] tracking-tight">
                  {code}
                </div>
              </div>

              {/* Interactive Draggable Sticker Layer (Forge Page) */}
              {stickers.length > 0 && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                  {stickers.map((stk) => {
                    const def = getStickerById(stk.stickerId);
                    const isSelected = editableStickers && selectedStickerUid === stk.uid;
                    return (
                      <div
                        key={stk.uid}
                        onPointerDown={(e) => {
                          if (!editableStickers) return;
                          e.stopPropagation();
                          setSelectedStickerUid(stk.uid);
                          e.currentTarget.setPointerCapture(e.pointerId);
                          dragStickerRef.current = {
                            uid: stk.uid,
                            startX: e.clientX,
                            startY: e.clientY,
                            origX: stk.x,
                            origY: stk.y,
                          };
                        }}
                        onPointerMove={(e) => {
                          if (!dragStickerRef.current || dragStickerRef.current.uid !== stk.uid) return;
                          e.stopPropagation();
                          const dxPct = ((e.clientX - dragStickerRef.current.startX) / width) * 100;
                          const dyPct = ((e.clientY - dragStickerRef.current.startY) / height) * 100;
                          onUpdateSticker?.(stk.uid, {
                            x: Math.min(92, Math.max(8, dragStickerRef.current.origX + dxPct)),
                            y: Math.min(88, Math.max(12, dragStickerRef.current.origY + dyPct)),
                          });
                        }}
                        onPointerUp={(e) => {
                          if (dragStickerRef.current?.uid === stk.uid) {
                            e.stopPropagation();
                            dragStickerRef.current = null;
                          }
                        }}
                        onDoubleClick={(e) => {
                          if (!editableStickers) return;
                          e.stopPropagation();
                          onRemoveSticker?.(stk.uid);
                        }}
                        style={{
                          left: `${stk.x}%`,
                          top: `${stk.y}%`,
                          transform: `translate(-50%, -50%) scale(${stk.scale}) rotate(${stk.rotation}deg)`,
                        }}
                        className={`absolute w-12 h-12 ${
                          editableStickers ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : ''
                        } ${isSelected ? 'ring-2 ring-[#FFD426] rounded-lg bg-black/30' : ''}`}
                      >
                        <svg
                          viewBox="0 0 64 64"
                          className="w-full h-full drop-shadow-[2px_2px_0px_#17171C]"
                          dangerouslySetInnerHTML={{ __html: def.svgInner }}
                        />
                        {isSelected && (
                          <div
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[#14151B] border-2 border-[#FFD426] rounded-md px-1 py-0.5 shadow-md"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSticker?.(stk.uid, {
                                  scale: Math.min(1.8, +(stk.scale + 0.15).toFixed(2)),
                                })
                              }
                              className="p-0.5 text-white hover:text-[#FFD426] cursor-pointer"
                              title="放大"
                            >
                              <ZoomIn className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSticker?.(stk.uid, {
                                  scale: Math.max(0.55, +(stk.scale - 0.15).toFixed(2)),
                                })
                              }
                              className="p-0.5 text-white hover:text-[#FFD426] cursor-pointer"
                              title="缩小"
                            >
                              <ZoomOut className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSticker?.(stk.uid, {
                                  rotation: (stk.rotation + 15) % 360,
                                })
                              }
                              className="p-0.5 text-white hover:text-[#00D4AA] cursor-pointer"
                              title="旋转"
                            >
                              <RotateCw className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveSticker?.(stk.uid)}
                              className="p-0.5 text-[#FF5526] hover:text-white cursor-pointer"
                              title="删除贴纸"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Embedded Audio Fingerprint Strip (for Forge Card) */}
              {waveformBars && waveformBars.length > 0 && (
                <div className="absolute bottom-2 left-2.5 right-2.5 z-20 pointer-events-none">
                  <div className="bg-[#14151B]/95 border-[2px] border-[#17171C] shadow-[0_2px_8px_rgba(0,0,0,0.4)] rounded-full px-2.5 py-1.5 flex items-center justify-between gap-[2px] h-7">
                    {waveformBars.map((val, i) => {
                      const colors = ['#7C3AED', '#FF3D9A', '#FF5526', '#FFD426', '#00D4AA', '#38BDF8'];
                      const barColor = colors[Math.floor((i / waveformBars.length) * colors.length)];
                      return (
                        <span
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-150 ${
                            waveformActive ? 'animate-pulse' : ''
                          }`}
                          style={{
                            height: `${Math.round(val * 100)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Precision Collector Title Nameplate */}
            <div
              className={`relative z-20 border-t-[2px] border-[#17171C] px-3 pt-1.5 pb-2 flex flex-col items-center justify-center shrink-0 ${
                rarity === 'LTD'
                  ? 'bg-[#14151B] text-[#FEF08A]'
                  : 'bg-[#FBF9F4] text-[#17171C]'
              }`}
            >
              {/* Micro Spec Top Hairline */}
              <div className="w-full flex items-center justify-between text-[8px] font-mono-hw font-bold tracking-[0.14em] opacity-60 mb-0.5">
                <span>{specLabel ?? category} · {foilMeta.label}</span>
                <span>HB-S01</span>
              </div>

              <div className="flex items-center gap-1.5 max-w-full">
                <span className="text-[10px] font-black opacity-80">✦</span>
                <span className="font-black italic tracking-wide text-[18px] leading-tight truncate uppercase">
                  {title}
                </span>
                <span className="text-[10px] font-black opacity-80">✦</span>
              </div>

              {zhTitle && (
                <span
                  className={`text-[10px] font-bold tracking-wider leading-tight ${
                    rarity === 'LTD' ? 'text-[#FFD426]/80' : 'text-[#626272]'
                  }`}
                >
                  {zhTitle}
                </span>
              )}

              {/* Miniature Holographic Authenticity Micro-Seal on SR+ cards */}
              {rarity !== 'N' && rarity !== 'R' && (
                <div
                  className="absolute bottom-1.5 left-2 w-4 h-4 rounded-full border border-[#17171C]/60 holo-shine-border flex items-center justify-center shadow-xs pointer-events-none"
                  title="HoloBeat Authenticated Foil"
                >
                  <span className="text-[6px] font-mono-hw font-black text-[#17171C]">✦</span>
                </div>
              )}
            </div>

            {/* Optical Layer 1: Zero-Washout Black-Valley Foil Diffraction */}
            <div className={`holo-foil-layer holo-foil-${foil}`} />

            {/* Optical Layer 2: Counter-Scrolling Crushed-Diamond Sparkle Facets */}
            <div className="holo-sparkle-layer" data-active={sparkleMode} />

            {/* Optical Layer 3: Subtle Micro-Paper / Foil Grain */}
            <div className="holo-noise-layer" />

            {/* Optical Layer 4: Directional Specular Glare */}
            <div className="holo-glare-layer" />

            {/* Optical Layer 5: 3D Edge Rim Glint */}
            <div className="holo-rim-glint" />

            {/* Refined Peeled Foil Corner Detail (SSR / UR / LTD Signature Touch) */}
            {isHighTier && (
              <svg
                viewBox="0 0 38 38"
                className="absolute bottom-0 right-0 w-7 h-7 z-25 pointer-events-none"
              >
                <defs>
                  <linearGradient id={`peel-${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="48%" stopColor={rarity === 'LTD' ? '#FEF08A' : '#CBD5E1'} />
                    <stop offset="100%" stopColor={rarity === 'LTD' ? '#B45309' : '#475569'} />
                  </linearGradient>
                </defs>
                <polygon points="38,0 38,38 0,38" fill="#14151B" />
                <path
                  d="M38,0 C27,13 23,21 0,38 C14,29 25,25 38,0 Z"
                  fill={`url(#peel-${uid})`}
                  stroke="#17171C"
                  strokeWidth="1.8"
                />
              </svg>
            )}

            {/* Interactive Scratch-to-Reveal Foil Layer for Newly Pulled Gacha Cards */}
            {needsScratch && onScratchReveal && (
              <ScratchOverlay width={width} height={height} onReveal={onScratchReveal} />
            )}
          </div>
        </div>

        {/* ================= BACK FACE (COLLECTOR SPEC SHEET) ================= */}
        <div
          className="holo-face holo-face-back bg-[#14151B] text-[#FBF9F4] p-4 flex flex-col justify-between"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          <div>
            {/* Top Spec Bar */}
            <div className="flex items-center justify-between pb-2.5 border-b border-white/15">
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-black border-[1.5px] border-[#17171C]"
                style={{ backgroundColor: catInfo.color, color: catInfo.textColor }}
              >
                {rarityInfo.label} · {catInfo.label}
              </span>
              <span className="font-mono-hw text-xs font-bold text-[#FFD426] tracking-wider">
                {code} // {foilMeta.label}
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-black italic tracking-wide uppercase text-[#FBF9F4] truncate">
                {title}
              </h3>
            </div>
            {zhTitle && (
              <p className="text-xs font-bold text-[#00D4AA] mt-0.5">{zhTitle}</p>
            )}

            {/* Collector Lore Box */}
            <div className="mt-3 p-2.5 rounded-xl bg-white/[0.06] border border-white/12">
              <div className="text-[9px] font-mono-hw font-bold uppercase tracking-[0.14em] text-[#FFD426] mb-1">
                ARCHIVE // 市井声景档案
              </div>
              <p className="text-xs leading-relaxed text-white/85">
                {storyZh ?? '纯前端离线程序化合成的专属全息声卡，封印你的高光街头节拍与物理旋律。'}
              </p>
            </div>

            {/* Synth Schematic Box */}
            <div className="mt-2.5 p-2.5 rounded-xl bg-black/55 border border-[#7C3AED]/55">
              <div className="text-[9px] font-mono-hw font-bold uppercase tracking-[0.14em] text-[#C084FC] mb-1">
                DSP ENGINE // SYNTH FORMULA
              </div>
              <code className="font-mono-hw text-[10.5px] text-[#00D4AA] leading-snug block">
                {synthFormula ?? 'Tone.js Procedural Multi-Voice Mix'}
              </code>
            </div>

            {/* Compact Spec Bars on Back */}
            {stats && (
              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                {[
                  { k: 'PUNCH', v: stats.punch, c: '#FF5526' },
                  { k: 'SHINE', v: stats.shine, c: '#FFD426' },
                  { k: 'VIBE', v: stats.vibe, c: '#A855F7' },
                ].map((item) => (
                  <div
                    key={item.k}
                    className="rounded-lg bg-white/[0.05] border border-white/10 px-2 py-1.5 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between font-mono-hw text-[9px]">
                      <span className="text-white/60">{item.k}</span>
                      <span className="font-bold text-white">{item.v}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${item.v}%`, backgroundColor: item.c }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2.5 border-t border-white/15 flex items-center justify-between text-[10px] font-mono-hw">
            <span className="text-white/65">REC BPM: {recommendedBpm}</span>
            <span className="text-[#FFD426] font-bold tracking-wider">HOLOBEAT · OFFLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
