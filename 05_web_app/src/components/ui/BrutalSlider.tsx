import React, { useRef, useState } from 'react';
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
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.01 : 0.05;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = value + step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = value - step;
    else if (e.key === 'PageUp') next = value + 0.15;
    else if (e.key === 'PageDown') next = value - 0.15;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 1;
    if (next !== null) {
      e.preventDefault();
      const clamped = Math.min(1, Math.max(0, next));
      playSfx('knobTick', clamped);
      onChange(clamped);
    }
  };

  return (
    <div className={`flex flex-col select-none ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-1 leading-none">
          <span className="text-[11px] font-bold text-[#1A1A1F] whitespace-nowrap">{label}</span>
          <span className="font-mono-hw text-[10px] font-bold text-[#5E5E6E]">
            {Math.round(value * 100)}
          </span>
        </div>
      )}
      <div
        ref={trackRef}
        role="slider"
        aria-label={label ?? '滑杆控制'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={`${Math.round(value * 100)}%`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.focus();
          draggingRef.current = true;
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          updateFromClientX(e.clientX);
        }}
        onPointerUp={() => {
          draggingRef.current = false;
          setDragging(false);
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
          setDragging(false);
        }}
        style={{ height }}
        className="relative w-full rounded-full bg-[#EDE7D9] border-[2px] border-[#1A1A1F] shadow-[inset_0_1.5px_3px_rgba(26,26,31,0.14)] cursor-ew-resize flex items-center"
      >
        <div className="absolute inset-x-3 inset-y-0 flex items-center justify-between pointer-events-none opacity-25">
          <span className="w-[1.5px] h-1.5 bg-[#1A1A1F] rounded-full" />
          <span className="w-[1.5px] h-2 bg-[#1A1A1F] rounded-full" />
          <span className="w-[1.5px] h-1.5 bg-[#1A1A1F] rounded-full" />
        </div>

        <div
          className="h-full rounded-l-full pointer-events-none transition-[width] duration-40"
          style={{
            width: `${Math.max(5, value * 100)}%`,
            backgroundColor: color,
          }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[15px] h-[22px] rounded-[5px] bg-[#FFFDF8] border-[2px] border-[#1A1A1F] shadow-[1.5px_2px_0px_0px_#1A1A1F] pointer-events-none flex items-center justify-center transition-transform duration-75 ${
            dragging ? 'scale-110 ring-2 ring-[#FFD60A]' : ''
          }`}
          style={{ left: `${Math.min(95, Math.max(5, value * 100))}%` }}
        >
          <span className="w-[2px] h-2.5 rounded-full bg-[#1A1A1F]/65" />
        </div>
      </div>
    </div>
  );
};
