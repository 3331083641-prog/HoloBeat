import React, { useEffect, useId, useRef, useState } from 'react';
import { Layers, RotateCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { getArtBriefByCardId } from '../../data/artBriefs';
import { CATEGORY_META, HOLO_FOIL_LIST, RARITY_META } from '../../data/soundCards';
import { getStickerById } from '../../data/stickers';
import { useHoloStore } from '../../store/useHoloStore';
import type {
  CompositionSnapshot,
  HoloFoilType,
  PlacedSticker,
  Rarity,
  TrackCategory,
} from '../../types/holo';
import { CardArtwork } from '../artwork/CardArtwork';
import { SoundSourceIcon } from '../icons/SoundSourceIcon';
import { ScratchOverlay } from './ScratchOverlay';
import { SoundSigil } from './SoundSigil';

export interface HoloCardProps {
  cardId?: string;
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
  N: 0.14,
  R: 0.3,
  SR: 0.55,
  SSR: 0.78,
  UR: 0.94,
  LTD: 0.86,
};

const RARITY_TILT_MAX: Record<Rarity, number> = {
  N: 8,
  R: 10,
  SR: 12,
  SSR: 14,
  UR: 15.5,
  LTD: 14.5,
};

export const HoloCard: React.FC<HoloCardProps> = ({
  cardId,
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
  const reducedMotionSetting = useHoloStore((s) => s.reducedMotion);
  const sceneRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const hoveringRef = useRef(false);
  const visibleRef = useRef(true);
  const [isVisible, setIsVisible] = useState(true);

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
  const brief = cardId ? getArtBriefByCardId(cardId) : null;

  const sparkleMode: 'none' | 'soft' | 'strong' =
    rarity === 'UR' || (foil === 'spark' && rarity !== 'N')
      ? 'strong'
      : rarity === 'SSR' || rarity === 'LTD'
        ? 'soft'
        : 'none';

  // Pause expensive optical/spring loops when card is scrolled off-screen!
  useEffect(() => {
    const node = sceneRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = Boolean(entries[0]?.isIntersecting);
        visibleRef.current = vis;
        setIsVisible(vis);
      },
      { threshold: 0.05 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const applyCssVars = (el: HTMLDivElement, s: typeof springRef.current) => {
    const hyp = Math.min(1, Math.hypot(s.px, s.py));
    const shadowX = (-s.ry * 1.1).toFixed(1);
    const shadowY = (16 + s.rx * 0.9).toFixed(1);

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
      reducedMotionSetting ||
      (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

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
        if (!el || !visibleRef.current) {
          rafRef.current = null;
          return;
        }
        const s = springRef.current;
        const t = targetRef.current;

        // Ultra-calm museum breathing at rest (artwork stays crisp & clear!)
        if (!hoveringRef.current && idleShimmer && !prefersReduced && !needsScratch && isHighTier) {
          const phase = now * 0.00065;
          const ix = Math.sin(phase) * 0.08;
          const iy = Math.sin(phase * 1.4) * 0.06;
          t.rx = -iy * 2.6;
          t.ry = ix * 3.0;
          t.px = ix;
          t.py = iy;
          t.gx = 50 + ix * 30;
          t.gy = 50 + iy * 30;
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

        const keepAmbient = idleShimmer && !prefersReduced && !needsScratch && isHighTier && visibleRef.current;
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

    if (idleShimmer && !prefersReduced && !needsScratch && isHighTier && isVisible) {
      startLoop();
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rarity, foilIntensity, idleShimmer, needsScratch, isHighTier, isVisible, reducedMotionSetting]);

  const ensureSpringRunning = () => {
    if (rafRef.current !== null || !visibleRef.current) return;
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
      if (!el || !visibleRef.current) {
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
    if (dragStickerRef.current || needsScratch || reducedMotionSetting) return;
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
      ry: px * (maxTilt + 1.2),
      px,
      py,
      gx: nx * 100,
      gy: ny * 100,
      sc: 1.022,
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
      ref={sceneRef}
      data-testid="hero-holo-card"
      className={`holo-scene select-none ${!isVisible || reducedMotionSetting ? 'holo-paused' : ''} ${className}`}
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
        <div className="holo-face holo-card-frame" data-rarity={rarity} data-foil={foil}>
          <div className="relative w-full h-full rounded-[11px] overflow-hidden border-[2px] border-[#1A1A1F] bg-[#14151B] flex flex-col">
            {/* Artwork Viewport (Optical Foil Layers Scoped Strictly Inside Art Box Below z-20!) */}
            <div className="relative flex-1 overflow-hidden">
              <CardArtwork artId={artId} parallax={!reducedMotionSetting} />

              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{ boxShadow: 'inset 0 0 18px rgba(20, 21, 27, 0.18)' }}
              />

              {/* Optical Foil Layers ONLY over artwork — protects faces, badges, stickers, waveform & nameplate! */}
              <div className={`holo-foil-layer holo-foil-${foil}`} />
              <div className="holo-sparkle-layer" data-active={sparkleMode} />
              <div className="holo-noise-layer" />
              <div className="holo-glare-layer" />
              <div className="holo-rim-glint" />

              {/* Sticker Center Snap Reference Guides */}
              {snapGuide.x && (
                <div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-[#FFD60A]/90 z-25 pointer-events-none" />
              )}
              {snapGuide.y && (
                <div className="absolute inset-x-0 top-1/2 h-[1.5px] bg-[#FFD60A]/90 z-25 pointer-events-none" />
              )}

              {/* Top-Left Collector Rarity Badge (Above Foil!) */}
              <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none flex items-center gap-1.5">
                <div
                  className={`relative px-2.5 py-0.5 font-extrabold tracking-tight border-[2px] border-[#1A1A1F] shadow-[2px_2px_0px_0px_#1A1A1F] rounded-[8px] ${
                    rarity === 'UR' || rarity === 'SSR'
                      ? 'text-[14px] -rotate-4'
                      : rarity === 'LTD'
                        ? 'text-[13px] -rotate-2 ring-1 ring-[#FFD60A]/70'
                        : 'text-[12.5px]'
                  }`}
                  style={{
                    backgroundColor: rarityInfo.bg,
                    color: rarityInfo.text,
                  }}
                >
                  {badgeLabel}
                </div>
                {isDemo && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[#14151B]/90 border border-[#FFD60A] text-[10px] font-bold text-[#FFD60A]">
                    示例
                  </span>
                )}
              </div>

              {/* Top-Right Serial Pill */}
              <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none flex items-center gap-1">
                <div className="px-2 py-0.5 rounded-full bg-[#FFFDF8]/95 border-[2px] border-[#1A1A1F] shadow-[2px_2px_0px_0px_#1A1A1F] font-mono-hw text-[11px] font-bold text-[#1A1A1F] tracking-tight">
                  {code}
                </div>
              </div>

              {/* Interactive Normalized-Coordinate Sticker Layer (Above Foil!) */}
              {stickers.length > 0 && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                  {stickers.map((stk) => {
                    const def = getStickerById(stk.stickerId);
                    const isSelected = editableStickers && selectedStickerUid === stk.uid;
                    return (
                      <div
                        key={stk.uid}
                        data-testid={`card-sticker-${stk.uid}`}
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
                        } ${isSelected ? 'ring-2 ring-[#FFD60A] rounded-lg bg-black/30' : ''}`}
                      >
                        <svg
                          viewBox="0 0 64 64"
                          className="w-full h-full drop-shadow-[2px_2px_0px_#1A1A1F]"
                          dangerouslySetInnerHTML={{ __html: def.svgInner }}
                        />
                        {isSelected && (
                          <div
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[#14151B] border-2 border-[#FFD60A] rounded-md px-1 py-0.5 shadow-md"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSticker?.(stk.uid, {
                                  scale: Math.min(1.8, +(stk.scale + 0.15).toFixed(2)),
                                })
                              }
                              className="p-0.5 text-white hover:text-[#FFD60A] cursor-pointer"
                              title="放大"
                              aria-label="放大贴纸"
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
                              className="p-0.5 text-white hover:text-[#FFD60A] cursor-pointer"
                              title="缩小"
                              aria-label="缩小贴纸"
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
                              title="旋转 15°"
                              aria-label="旋转贴纸"
                            >
                              <RotateCw className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onBringStickerFront?.(stk.uid)}
                              className="p-0.5 text-white hover:text-[#38BDF8] cursor-pointer"
                              title="置于顶层"
                              aria-label="贴纸置于顶层"
                            >
                              <Layers className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveSticker?.(stk.uid)}
                              className="p-0.5 text-[#FF5C2B] hover:text-white cursor-pointer"
                              title="删除贴纸"
                              aria-label="删除贴纸"
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

              {/* Embedded Real PCM Waveform Strip (Protected Above Foil!) */}
              {waveformBars && waveformBars.length > 0 && (
                <div className="absolute bottom-2 left-2.5 right-2.5 z-20 pointer-events-none">
                  <div className="bg-[#14151B]/95 border-[2px] border-[#1A1A1F] shadow-[0_2px_8px_rgba(0,0,0,0.38)] rounded-full px-2.5 py-1.5 flex items-center justify-between gap-[2px] h-7">
                    {waveformBars.map((val, i) => {
                      const colors = ['#7C3AED', '#FF5C2B', '#FFD60A', '#00D4AA'];
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

            {/* Crisp Matte Collector Nameplate (Completely Protected from Foil Washout!) */}
            <div
              className={`relative z-20 border-t-[2px] border-[#1A1A1F] px-3 pt-2 pb-2.5 flex flex-col items-center justify-center shrink-0 ${
                rarity === 'LTD'
                  ? 'bg-[#14151B] text-[#FEF08A]'
                  : 'bg-[#FFFDF8] text-[#1A1A1F]'
              }`}
            >
              <div className="w-full flex items-center justify-between text-[11px] font-bold opacity-70 mb-0.5">
                <span className="truncate">
                  {specLabel ?? catInfo.zhLabel} · {foilMeta.zhLabel}
                </span>
                {lineageLabel && <span className="truncate ml-2">{lineageLabel}</span>}
              </div>

              <div className="flex items-center gap-1.5 max-w-full">
                <span className="text-[11px] font-bold opacity-75">✦</span>
                <span className="zh-display text-[19px] leading-tight truncate">
                  {zhTitle ?? title}
                </span>
                <span className="text-[11px] font-bold opacity-75">✦</span>
              </div>
            </div>

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
                  stroke="#1A1A1F"
                  strokeWidth="1.8"
                />
              </svg>
            )}

            {needsScratch && onScratchReveal && (
              <ScratchOverlay width={width} height={height} onReveal={onScratchReveal} />
            )}
          </div>
        </div>

        {/* ================= BACK FACE (SOUND-SOURCE EVIDENCE & ARCHIVE SHEET) ================= */}
        <div
          className="holo-face holo-face-back bg-[#14151B] text-[#FFFDF8] p-3.5 flex flex-col justify-between overflow-hidden"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/15">
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-bold border-[1.5px] border-[#1A1A1F]"
                style={{ backgroundColor: catInfo.color, color: catInfo.textColor }}
              >
                {rarityInfo.label} · {specLabel ?? catInfo.zhLabel}
              </span>
              <span className="font-mono-hw text-[11px] font-bold text-[#FFD60A] tracking-wide">
                {code} · {foilMeta.zhLabel}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {cardId && (
                  <div className="w-9 h-9 rounded-xl bg-[#FFFDF8] border-[2px] border-[#1A1A1F] flex items-center justify-center shrink-0">
                    <SoundSourceIcon cardId={cardId} size={24} />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-[17px] zh-display text-[#FFFDF8] truncate leading-tight">
                    {zhTitle ?? title}
                  </h3>
                  {brief && (
                    <div className="text-[11px] text-[#00D4AA] font-medium truncate">
                      声源物件：{brief.sourceObject}
                    </div>
                  )}
                  {lineageLabel && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-[#7C3AED]/30 border border-[#A855F7]/60 text-[10px] font-bold text-[#E9D5FF]">
                      {lineageLabel}
                    </span>
                  )}
                </div>
              </div>
              {sigilSnapshot && <SoundSigil snapshot={sigilSnapshot} size={56} />}
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/12">
              <div className="text-[11px] font-bold text-[#FFD60A] mb-0.5">
                市井声景档案
              </div>
              <p className="text-[12px] leading-relaxed text-white/88 zh-body">
                {storyZh ?? '由声卡造物局封存的数字声音作品卡，支持随时播放、导出与拆封重混。'}
              </p>
              {pairingHintZh && (
                <p className="text-[11px] leading-snug text-[#00D4AA] mt-1.5 pt-1.5 border-t border-white/10">
                  推荐搭配：{pairingHintZh}
                </p>
              )}
            </div>

            <div className="p-2 rounded-xl bg-black/55 border border-[#7C3AED]/55">
              <div className="text-[11px] font-bold text-[#C084FC] mb-0.5">
                合成声学配方
              </div>
              <code className="text-[11px] text-[#00D4AA] leading-snug block">
                {synthFormula ?? '受市井声景启发的离线程序化多声部合成'}
              </code>
            </div>

            {stats && (
              <div>
                <div className="flex items-center justify-between text-[11px] text-white/60 mb-1">
                  <span className="font-bold">音色气质（创作风格参考）</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { k: '冲击', v: stats.punch, c: '#FF5C2B' },
                    { k: '光泽', v: stats.shine, c: '#FFD60A' },
                    { k: '氛围', v: stats.vibe, c: '#7C3AED' },
                  ].map((item) => (
                    <div
                      key={item.k}
                      className="rounded-lg bg-white/[0.05] border border-white/10 px-2 py-1 flex flex-col gap-0.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-white/75 font-bold">{item.k}</span>
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

          <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px] font-mono-hw">
            <span className="text-white/70">
              推荐 {recommendedBpm} BPM
              {ownedCount !== undefined ? ` · 已收录 ×${ownedCount}` : ''}
            </span>
            <span className="text-[#FFD60A] font-bold tracking-wider">HOLOBEAT</span>
          </div>
        </div>
      </div>
    </div>
  );
};
