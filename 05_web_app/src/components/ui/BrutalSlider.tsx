import React, { useRef } from 'react';
import { useHoloSfx } from '../../audio/useHoloSfx';

interface BrutalSliderProps {
  value: number; // 0..1
  onChange: (val: number) => void;
  color?: string;
  label?: string;
  height?: number;
  className?: string;
}

export const BrutalSlider: React.FC<BrutalSliderProps> = ({
  value,
  onChange,
  color = '#7C3AED',
  label,
  height = 14,
  className = '',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastStep = useRef(Math.round(value * 12));
  const playSfx = useHoloSfx();

  const updateFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const step = Math.round(ratio * 12);
    if (step !== lastStep.current) {
      lastStep.current = step;
      playSfx('knobTick', ratio);
    }
    onChange(ratio);
  };

  return (
    <div className={`flex flex-col select-none ${className}`}>
      {label && (
        <span className="text-[10px] font-black tracking-wider uppercase text-[#1A1A1F] mb-1 leading-none">
          {label}
        </span>
      )}
      <div
        ref={trackRef}
        role="slider"
        aria-label={label ?? 'slider'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault();
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          updateFromClientX(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        style={{ height }}
        className="relative w-full rounded-full bg-[#EDE7D9] border-[2px] border-[#1A1A1F] cursor-ew-resize flex items-center"
      >
        <div
          className="h-full rounded-l-full pointer-events-none"
          style={{
            width: `${Math.max(4, value * 100)}%`,
            backgroundColor: color,
          }}
        />
        {/* Chunky Neo-Brutalist White Pill Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[14px] h-[22px] rounded-[5px] bg-[#FFFDF8] border-[2.5px] border-[#1A1A1F] shadow-[1px_2px_0px_0px_#1A1A1F] pointer-events-none"
          style={{ left: `${Math.min(96, Math.max(4, value * 100))}%` }}
        />
      </div>
    </div>
  );
};
