import React, { useRef } from 'react';
import { useHoloSfx } from '../../audio/useHoloSfx';

interface BrutalKnobProps {
  value: number; // 0..1
  onChange: (val: number) => void;
  color?: string;
  size?: number;
  label?: string;
  title?: string;
}

export const BrutalKnob: React.FC<BrutalKnobProps> = ({
  value,
  onChange,
  color = '#FFD60A',
  size = 42,
  label,
  title,
}) => {
  const playSfx = useHoloSfx();
  const dragRef = useRef<{ startY: number; startVal: number; lastTickStep: number } | null>(null);

  const angleDeg = -135 + value * 270;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      startVal: value,
      lastTickStep: Math.round(value * 16),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.clientY;
    const next = Math.min(1, Math.max(0, dragRef.current.startVal + dy / 110));
    const step = Math.round(next * 16);
    if (step !== dragRef.current.lastTickStep) {
      dragRef.current.lastTickStep = step;
      playSfx('knobTick', next);
    }
    onChange(next);
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="flex flex-col items-center select-none" title={title}>
      {label && (
        <span className="text-[10px] font-black tracking-wider uppercase text-[#1A1A1F] mb-0.5 leading-none">
          {label}
        </span>
      )}
      <div
        role="slider"
        aria-label={label ?? 'knob'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => {
          onChange(0.5);
          playSfx('click', 0.5);
        }}
        style={{
          width: size,
          height: size,
          backgroundColor: color,
        }}
        className="relative rounded-full border-[2.5px] border-[#1A1A1F] shadow-[2px_3px_0px_0px_#1A1A1F] cursor-ns-resize flex items-center justify-center active:brightness-105"
      >
        {/* Subtle top highlight crescent */}
        <div className="absolute inset-1 rounded-full bg-gradient-to-br from-white/40 via-transparent to-black/15 pointer-events-none" />
        {/* Rotatable Indicator Notch */}
        <div
          className="w-full h-full flex justify-center pt-1 pointer-events-none"
          style={{ transform: `rotate(${angleDeg}deg)` }}
        >
          <div className="w-[4px] h-[34%] rounded-full bg-[#1A1A1F] border border-white/50" />
        </div>
      </div>
    </div>
  );
};
