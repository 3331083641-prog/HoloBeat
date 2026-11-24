import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { CATEGORY_META, RARITY_META } from '../../data/soundCards';
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
  width?: number;
  height?: number;
  className?: string;
}

export const HoloCard: React.FC<HoloCardProps> = ({
  title,
  zhTitle,
  code,
  rarity,
  category = 'PERC',
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
  width = 278,
  height = 388,
  className = '',
}) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ rx: 0, ry: 0, px: 0, py: 0, gx: 50, gy: 50 });
  const currentRef = useRef({ rx: 0, ry: 0, px: 0, py: 0, gx: 50, gy: 50 });
  const hoveringRef = useRef(false);

  const [selectedStickerUid, setSelectedStickerUid] = useState<string | null>(null);
  const dragStickerRef = useRef<{
    uid: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Smooth zero-React-rerender rAF damping loop for 3D tilt + holo sheen
  const ensureLoop = () => {
    if (rafRef.current !== null) return;
    const tick = () => {
      const el = shellRef.current;
      if (!el) {
        rafRef.current = null;
        return;
      }
      const c = currentRef.current;
      const t = targetRef.current;
      const ease = hoveringRef.current ? 0.22 : 0.12;
      c.rx += (t.rx - c.rx) * ease;
      c.ry += (t.ry - c.ry) * ease;
      c.px += (t.px - c.px) * ease;
      c.py += (t.py - c.py) * ease;
      c.gx += (t.gx - c.gx) * ease;
      c.gy += (t.gy - c.gy) * ease;

      el.style.setProperty('--rotate-x', `${c.rx.toFixed(2)}deg`);
      el.style.setProperty('--rotate-y', `${c.ry.toFixed(2)}deg`);
      el.style.setProperty('--px', c.px.toFixed(3));
      el.style.setProperty('--py', c.py.toFixed(3));
      el.style.setProperty('--pointer-x', `${c.gx.toFixed(1)}%`);
      el.style.setProperty('--pointer-y', `${c.gy.toFixed(1)}%`);
      el.style.setProperty('--bg-x', `${(100 - c.gx).toFixed(1)}%`);
      el.style.setProperty('--bg-y', `${(100 - c.gy).toFixed(1)}%`);

      const settled =
        !hoveringRef.current &&
        Math.abs(c.rx) < 0.05 &&
        Math.abs(c.ry) < 0.05 &&
        Math.abs(c.gx - 50) < 0.2;

      if (settled) {
        el.classList.remove('holo-active');
        rafRef.current = null;
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStickerRef.current || needsScratch) return;
    const el = shellRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const px = (nx - 0.5) * 2; // -1..1
    const py = (ny - 0.5) * 2;

    hoveringRef.current = true;
    el.classList.add('holo-active');
    targetRef.current = {
      rx: -py * 13,
      ry: px * 14,
      px,
      py,
      gx: nx * 100,
      gy: ny * 100,
    };
    ensureLoop();
  };

  const handlePointerLeave = () => {
    hoveringRef.current = false;
    targetRef.current = { rx: 0, ry: 0, px: 0, py: 0, gx: 50, gy: 50 };
    ensureLoop();
  };

  const rarityInfo = RARITY_META[rarity];
  const catInfo = CATEGORY_META[category];

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
      <div
        ref={shellRef}
        className={`holo-card-shell w-full h-full shadow-[0_14px_34px_rgba(0,0,0,0.55)] ${
          flipped ? 'holo-flipped' : ''
        }`}
      >
        {/* ================= FRONT FACE ================= */}
        <div className="holo-face holo-rainbow-frame" data-foil={foil}>
          <div className="relative w-full h-full rounded-[11px] overflow-hidden border-[2.5px] border-[#1A1A1F] bg-[#181820] flex flex-col">
            {/* Layer 1: 3-Layer Parallax Vector Street-Toy Mascot */}
            <div className="relative flex-1 overflow-hidden">
              <CardArtwork artId={artId} parallax />

              {/* Top-Left Comic Jagged Rarity Badge */}
              <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
                <div
                  className="relative px-3 py-1 font-black text-base tracking-tight border-[2.5px] border-[#1A1A1F] shadow-[2.5px_2.5px_0px_0px_#1A1A1F] -rotate-6 rounded-[7px]"
                  style={{
                    backgroundColor: rarityInfo.bg,
                    color: rarityInfo.text,
                  }}
                >
                  {rarity === 'UR' ? '✦ UR' : rarityInfo.label}
                </div>
              </div>

              {/* Top-Right Serial ID Pill */}
              <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
                <div className="px-2.5 py-0.5 rounded-full bg-[#FFFDF8] border-[2.5px] border-[#1A1A1F] shadow-[2px_2px_0px_0px_#1A1A1F] font-mono-hw text-xs font-black text-[#1A1A1F]">
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
                        } ${isSelected ? 'ring-2 ring-[#FFD60A] rounded-lg bg-black/25' : ''}`}
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
                            className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[#181820] border-2 border-[#FFD60A] rounded-md px-1 py-0.5 shadow-md"
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
                              className="p-0.5 text-[#FF5C2B] hover:text-white cursor-pointer"
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
                <div className="absolute bottom-2 left-3 right-3 z-20 pointer-events-none">
                  <div className="bg-[#181820]/95 border-[2px] border-[#1A1A1F] rounded-full px-2.5 py-1.5 flex items-center justify-between gap-[2px] h-7">
                    {waveformBars.map((val, i) => {
                      const colors = ['#7C3AED', '#FF3D9A', '#FF5C2B', '#FFD60A', '#00D4AA', '#38BDF8'];
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

            {/* Bottom Title Ribbon */}
            <div className="relative z-20 bg-[#FFFDF8]/92 border-t-[2.5px] border-[#1A1A1F] px-3 py-2 flex flex-col items-center justify-center shrink-0">
              <div className="flex items-center gap-1.5 max-w-full">
                <span className="text-[11px] font-black text-[#1A1A1F]">✦</span>
                <span className="font-black italic tracking-wide text-[19px] leading-none text-[#1A1A1F] truncate uppercase">
                  {title}
                </span>
                <span className="text-[11px] font-black text-[#1A1A1F]">✦</span>
              </div>
              {zhTitle && (
                <span className="text-[10px] font-bold text-[#5C5C6B] mt-0.5 tracking-wider">
                  {zhTitle}
                </span>
              )}
            </div>

            {/* Layer 2: Foil Spectrum Layer (color-dodge) */}
            <div className={`holo-foil-layer holo-foil-${foil}`} />
            {/* Layer 3: Inline SVG Fractal Noise Micro-Texture */}
            <div className="holo-noise-layer" />
            {/* Layer 4: Specular Glare Hotspot */}
            <div className="holo-glare-layer" />

            {/* Iconic Bottom-Right Peeled Silver Foil Corner Detail (Matches Mockups 1 & 4!) */}
            <svg
              viewBox="0 0 42 42"
              className="absolute bottom-0 right-0 w-9 h-9 z-25 pointer-events-none"
            >
              <polygon points="42,0 42,42 0,42" fill="#181820" />
              <path
                d="M42,0 C30,14 26,24 0,42 C16,32 28,28 42,0 Z"
                fill="url(#peel-grad)"
                stroke="#1A1A1F"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="peel-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="50%" stopColor="#CBD5E1" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
              </defs>
            </svg>

            {/* Interactive Scratch-to-Reveal Foil Layer for Newly Pulled Gacha Cards */}
            {needsScratch && onScratchReveal && (
              <ScratchOverlay width={width} height={height} onReveal={onScratchReveal} />
            )}
          </div>
        </div>

        {/* ================= BACK FACE (FLIP INFO) ================= */}
        <div className="holo-face holo-face-back bg-[#181820] text-[#FFFDF8] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b-2 border-white/15">
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-black border-2 border-[#1A1A1F]"
                style={{ backgroundColor: catInfo.color, color: catInfo.textColor }}
              >
                {rarityInfo.label} · {catInfo.label}
              </span>
              <span className="font-mono-hw text-xs font-bold text-[#FFD60A]">{code}</span>
            </div>

            <h3 className="mt-3 text-lg font-black tracking-wide uppercase text-[#FFFDF8]">
              {title}
            </h3>
            {zhTitle && (
              <p className="text-xs font-bold text-[#00D4AA] mt-0.5">{zhTitle}</p>
            )}

            <div className="mt-3 p-2.5 rounded-xl bg-white/8 border border-white/15">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#FFD60A] mb-1">
                市井灵感档案 · STREET LORE
              </div>
              <p className="text-xs leading-relaxed text-white/85">
                {storyZh ?? '纯前端离线程序化合成的专属全息声卡，封印你的高光街头节拍与物理旋律。'}
              </p>
            </div>

            <div className="mt-2.5 p-2.5 rounded-xl bg-black/50 border border-[#7C3AED]/60">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#C084FC] mb-1">
                WEB AUDIO SYNTH FORMULA
              </div>
              <code className="font-mono-hw text-[11px] text-[#00D4AA] leading-snug block">
                {synthFormula ?? 'Tone.js Procedural Multi-Voice Mix'}
              </code>
            </div>
          </div>

          <div className="pt-2.5 border-t-2 border-white/15 flex items-center justify-between text-[11px] font-mono-hw">
            <span className="text-white/70">REC BPM: {recommendedBpm}</span>
            {stats && (
              <span className="text-[#FFD60A] font-bold">
                PWR {Math.round((stats.punch + stats.shine + stats.vibe) / 3)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
