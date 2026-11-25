import React, { useMemo } from 'react';
import { buildSoundSigilData } from '../../audio/compositionEngine';
import type { CompositionSnapshot } from '../../types/holo';

interface SoundSigilProps {
  snapshot: CompositionSnapshot;
  size?: number;
  className?: string;
}

/**
 * Deterministic Generative Sound Sigil (声音纹章)
 * Distinct from the real PCM waveform strip: transforms the work's rhythm density,
 * 4-track energy ratios, and FNV-1a seed into a collectible geometric art emblem.
 */
export const SoundSigil: React.FC<SoundSigilProps> = ({
  snapshot,
  size = 86,
  className = '',
}) => {
  const sigil = useMemo(() => buildSoundSigilData(snapshot), [snapshot]);
  const cx = 50;
  const cy = 50;
  const maxR = 40;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`shrink-0 select-none ${className}`}
      aria-label="声音纹章"
    >
      <circle cx={cx} cy={cy} r="46" fill="#14151B" stroke="#2D2F3B" strokeWidth="2" />

      {/* Concentric harmonic balance rings */}
      {sigil.rings.map((ratio, idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r={maxR * ratio}
          fill="none"
          stroke={idx === 2 ? 'rgba(255,214,10,0.28)' : 'rgba(255,255,255,0.14)'}
          strokeWidth={idx === 2 ? 1.2 : 1}
          strokeDasharray={idx === 1 ? '3 3' : undefined}
        />
      ))}

      {/* 16 temporal rhythm-energy spokes */}
      {sigil.spokes.map((sp, i) => {
        const innerR = 11;
        const outerR = innerR + sp.length * (maxR - innerR);
        const x1 = cx + Math.cos(sp.angle) * innerR;
        const y1 = cy + Math.sin(sp.angle) * innerR;
        const x2 = cx + Math.cos(sp.angle) * outerR;
        const y2 = cy + Math.sin(sp.angle) * outerR;
        return (
          <g key={i}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={sp.color}
              strokeWidth={sp.dot ? 2.4 : 1.1}
              strokeLinecap="round"
              opacity={sp.dot ? 0.95 : 0.35}
            />
            {sp.dot && (
              <circle
                cx={x2}
                cy={y2}
                r="2.2"
                fill="#FFFDF8"
                stroke={sp.color}
                strokeWidth="1"
              />
            )}
          </g>
        );
      })}

      {/* Center Core Seal */}
      <circle cx={cx} cy={cy} r="9" fill="#181820" stroke="#FFD60A" strokeWidth="1.6" />
      <path
        d="M50 44 L51.8 48.2 L56 50 L51.8 51.8 L50 56 L48.2 51.8 L44 50 L48.2 48.2 Z"
        fill="#FFD60A"
      />
    </svg>
  );
};
