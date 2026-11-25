import React, { useEffect, useId, useRef, useState } from 'react';
import { Layers, RotateCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { CATEGORY_META, HOLO_FOIL_LIST, RARITY_META } from '../../data/soundCards';
import { getStickerById } from '../../data/stickers';
import type {
  CompositionSnapshot,
  HoloFoilType,
  PlacedSticker,
  Rarity,
  TrackCategory,
} from '../../types/holo';
import { CardArtwork } from '../artwork/CardArtwork';
import { ScratchOverlay } from './ScratchOverlay';
import { SoundSigil } from './SoundSigil';

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
  pairingHintZh?: string;
  synthFormula?: string;
  recommendedBpm?: number;
  stats?: { punch: number; shine: number; vibe: number };
  ownedCount?: number;
  isDemo?: boolean;
  lineageLabel?: string;
  sigilSnapshot?: CompositionSnapshot | null;
  flipped?: boolean;
  needsScratch?: boolean;
  onScratchReveal?: () => void;
  waveformBars?: number[];
  waveformActive?: boolean;
  /** 0..1 playback progress sweep across the embedded waveform strip */
  waveformProgress?: number;
  stickers?: PlacedSticker[];
  editableStickers?: boolean;
  onUpdateSticker?: (uid: string, patch: Partial<PlacedSticker>) => void;
  onBringStickerFront?: (uid: string) => void;
  onRemoveSticker?: (uid: string) => void;
  showAura?: boolean;
  idleShimmer?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

const RARITY_FOIL_INTENSITY: Record<Rarity, number> = {
  N: 0.12,
  R: 0.28,
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
  pairingHintZh,
  synthFormula,
  recommendedBpm = 120,
  stats,
  ownedCount,
  isDemo = false,
  lineageLabel,
  sigilSnapshot,
  flipped = false,
  needsScratch = false,
  onScratchReveal,
  waveformBars,
  waveformActive = false,
  waveformProgress = -1,
  stickers = [],
  editableStickers = false,
  onUpdateSticker,
  onBringStickerFront,
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

  // Hooke's Law Damped Spring State
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
  const [snapGuide, setSnapGuide] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
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

        // Calm museum breathing when idle so artwork stays sharp & still, subtly catching light
        if (!hoveringRef.current && idleShimmer && !prefersReduced && !needsScratch && isHighTier) {
          const phase = now * 0.00075;
          const ix = Math.sin(phase) * 0.14;
          const iy = Math.sin(phase * 1.5) * 0.1;
          t.rx = -iy * 3.5;
          t.ry = ix * 4.0;
          t.px = ix;
          t.py = iy;
          t.gx = 50 + ix * 36;
          t.gy = 50 + iy * 36;
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

        const keepAmbient = idleShimmer && !prefersReduced && !needsScratch && isHighTier;
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

    if (idleShimmer && !prefersReduced && !needsScratch && isHighTier) {
      startLoop();
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rarity, foilIntensity, idleShimmer, needsScratch, isHighTier]);

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
            <div className="relative flex-1 overflow-hidden">
              <CardArtwork artId={artId} parallax />

              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{ boxShadow: 'inset 0 0 22px rgba(20, 21, 27, 0.24)' }}
              />

              {/* Sticker Center Snap Reference Guides (Only when dragging near center!) */}
              {snapGuide.x && (
                <div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-[#FFD426]/85 z-25 pointer-events-none" />
              )}
              {snapGuide.y && (
                <div className="absolute inset-x-0 top-1/2 h-[1.5px] bg-[#FFD426]/85 z-25 pointer-events-none" />
              )}

              {/* Top-Left Tiered Collector Rarity Badge */}
              <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none flex items-center gap-1.5">
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
                {isDemo && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[#14151B]/90 border border-[#FFD426] text-[9.5px] font-black text-[#FFD426]">
                    示例
                  </span>
                )}
              </div>

              {/* Top-Right Precision Serial Number Pill */}
              <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none flex items-center gap-1">
                <div className="px-2 py-0.5 rounded-full bg-[#FBF9F4]/95 border-[2px] border-[#17171C] shadow-[2px_2px_0px_0px_#17171C] font-mono-hw text-[11px] font-black text-[#17171C] tracking-tight">
                  {code}
                </div>
              </div>

              {/* Interactive Draggable / Snappable Sticker Layer (Forge Page) */}
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
                          onBringStickerFront?.(stk.uid);
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
                          let nx = Math.min(92, Math.max(8, dragStickerRef.current.origX + dxPct));
                          let ny = Math.min(86, Math.max(12, dragStickerRef.current.origY + dyPct));
                          const snapX = Math.abs(nx - 50) < 2.6;
                          const snapY = Math.abs(ny - 50) < 2.6;
                          if (snapX) nx = 50;
                          if (snapY) ny = 50;
                          setSnapGuide({ x: snapX, y: snapY });
                          onUpdateSticker?.(stk.uid, { x: nx, y: ny });
                        }}
                        onPointerUp={(e) => {
                          if (dragStickerRef.current?.uid === stk.uid) {
                            e.stopPropagation();
                            dragStickerRef.current = null;
                            setSnapGuide({ x: false, y: false });
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
                          zIndex: stk.zIndex ?? 1,
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
                              onClick={() => onBringStickerFront?.(stk.uid)}
                              className="p-0.5 text-white hover:text-[#38BDF8] cursor-pointer"
                              title="置于顶层"
                            >
                              <Layers className="w-3 h-3" />
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

              {/* Embedded Real Audio Fingerprint Strip with Live Playback Sweep! */}
              {waveformBars && waveformBars.length > 0 && (
                <div className="absolute bottom-2 left-2.5 right-2.5 z-20 pointer-events-none">
                  <div className="bg-[#14151B]/95 border-[2px] border-[#17171C] shadow-[0_2px_8px_rgba(0,0,0,0.4)] rounded-full px-2.5 py-1.5 flex items-center justify-between gap-[2px] h-7">
                    {waveformBars.map((val, i) => {
                      const colors = ['#7C3AED', '#FF3D9A', '#FF5526', '#FFD426', '#00D4AA', '#38BDF8'];
                      const barColor = colors[Math.floor((i / waveformBars.length) * colors.length)];
                      const frac = i / Math.max(1, waveformBars.length - 1);
                      const isLit = waveformProgress >= 0 ? frac <= waveformProgress : true;
                      return (
                        <span
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-100 ${
                            waveformActive && waveformProgress < 0 ? 'animate-pulse' : ''
                          }`}
                          style={{
                            height: `${Math.round(val * 100)}%`,
                            backgroundColor: barColor,
                            opacity: isLit ? 1 : 0.34,
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
              <div className="w-full flex items-center justify-between text-[9.5px] font-bold tracking-wide opacity-65 mb-0.5">
                <span className="truncate">
                  {specLabel ?? catInfo.zhLabel} · {foilMeta.zhLabel}
                </span>
                {lineageLabel && <span className="truncate ml-2">{lineageLabel}</span>}
              </div>

              <div className="flex items-center gap-1.5 max-w-full">
                <span className="text-[10px] font-black opacity-75">✦</span>
                <span className="zh-display text-[17.5px] leading-tight truncate">
                  {zhTitle ?? title}
                </span>
                <span className="text-[10px] font-black opacity-75">✦</span>
              </div>

              {rarity !== 'N' && rarity !== 'R' && (
                <div
                  className="absolute bottom-1.5 left-2 w-4 h-4 rounded-full border border-[#17171C]/60 holo-shine-border flex items-center justify-center shadow-xs pointer-events-none"
                  title="全息防伪认证印记"
                >
                  <span className="text-[6px] font-mono-hw font-black text-[#17171C]">✦</span>
                </div>
              )}
            </div>

            {/* Optical Layers */}
            <div className={`holo-foil-layer holo-foil-${foil}`} />
            <div className="holo-sparkle-layer" data-active={sparkleMode} />
            <div className="holo-noise-layer" />
            <div className="holo-glare-layer" />
            <div className="holo-rim-glint" />

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

            {needsScratch && onScratchReveal && (
              <ScratchOverlay width={width} height={height} onReveal={onScratchReveal} />
            )}
          </div>
        </div>

        {/* ================= BACK FACE (COLLECTOR ARCHIVE & LINEAGE SHEET) ================= */}
        <div
          className="holo-face holo-face-back bg-[#14151B] text-[#FBF9F4] p-3.5 flex flex-col justify-between overflow-hidden"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/15">
              <span
                className="px-2 py-0.5 rounded-full text-[10.5px] font-black border-[1.5px] border-[#17171C]"
                style={{ backgroundColor: catInfo.color, color: catInfo.textColor }}
              >
                {rarityInfo.label} · {specLabel ?? catInfo.zhLabel}
              </span>
              <span className="font-mono-hw text-[10.5px] font-bold text-[#FFD426] tracking-wide">
                {code} · {foilMeta.zhLabel}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[16px] zh-display text-[#FBF9F4] truncate leading-tight">
                  {zhTitle ?? title}
                </h3>
                {lineageLabel && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-[#7C3AED]/30 border border-[#A855F7]/60 text-[9.5px] font-bold text-[#E9D5FF]">
                    {lineageLabel}
                  </span>
                )}
              </div>
              {sigilSnapshot && <SoundSigil snapshot={sigilSnapshot} size={58} />}
            </div>

            <div className="p-2 rounded-xl bg-white/[0.06] border border-white/12">
              <div className="text-[9.5px] font-bold tracking-wider text-[#FFD426] mb-0.5">
                市井声景档案
              </div>
              <p className="text-[11px] leading-relaxed text-white/85">
                {storyZh ?? '由声卡造物局封存的数字声音藏品，支持随时拆封重混与离线无损导出。'}
              </p>
              {pairingHintZh && (
                <p className="text-[10px] leading-snug text-[#00D4AA]/90 mt-1 pt-1 border-t border-white/10">
                  搭配建议：{pairingHintZh}
                </p>
              )}
            </div>

            <div className="p-2 rounded-xl bg-black/55 border border-[#7C3AED]/55">
              <div className="text-[9.5px] font-bold tracking-wider text-[#C084FC] mb-0.5">
                合成声学配方
              </div>
              <code className="text-[10.5px] text-[#00D4AA] leading-snug block">
                {synthFormula ?? '离线程序化多声部合成引擎'}
              </code>
            </div>

            {stats && (
              <div>
                <div className="text-[9.5px] font-bold tracking-wider text-white/55 mb-1">
                  音色特征
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { k: '冲击', v: stats.punch, c: '#FF5526' },
                    { k: '光泽', v: stats.shine, c: '#FFD426' },
                    { k: '氛围', v: stats.vibe, c: '#A855F7' },
                  ].map((item) => (
                    <div
                      key={item.k}
                      className="rounded-lg bg-white/[0.05] border border-white/10 px-2 py-1 flex flex-col gap-0.5"
                    >
                      <div className="flex items-center justify-between text-[9.5px]">
                        <span className="text-white/70 font-bold">{item.k}</span>
                        <span className="font-mono-hw font-bold text-white">{item.v}</span>
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
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[10px] font-mono-hw">
            <span className="text-white/65">
              推荐 {recommendedBpm} BPM
              {ownedCount !== undefined ? ` · 已收录 ×${ownedCount}` : ''}
            </span>
            <span className="text-[#FFD426] font-bold tracking-wider">HOLOBEAT</span>
          </div>
        </div>
      </div>
    </div>
  );
};
