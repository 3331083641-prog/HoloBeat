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

  return (
    <div className={`flex flex-col select-none ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-1 leading-none">
          <span className="text-[10px] font-extrabold tracking-wide text-[#17171C] whitespace-nowrap">
            {label}
          </span>
          <span className="font-mono-hw text-[9.5px] font-bold text-[#626272]">
            {Math.round(value * 100)}
          </span>
        </div>
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
        className="relative w-full rounded-full bg-[#E7E1D3] border-[2px] border-[#17171C] shadow-[inset_0_1.5px_3px_rgba(23,23,28,0.16)] cursor-ew-resize flex items-center"
      >
        {/* Subtle Calibrated Rail Notches */}
        <div className="absolute inset-x-3 inset-y-0 flex items-center justify-between pointer-events-none opacity-25">
          <span className="w-[1.5px] h-1.5 bg-[#17171C] rounded-full" />
          <span className="w-[1.5px] h-2 bg-[#17171C] rounded-full" />
          <span className="w-[1.5px] h-1.5 bg-[#17171C] rounded-full" />
        </div>

        <div
          className="h-full rounded-l-full pointer-events-none transition-[width] duration-40"
          style={{
            width: `${Math.max(5, value * 100)}%`,
            backgroundColor: color,
          }}
        />
        {/* Teenage Engineering Style Ridged Fader Cap */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[15px] h-[22px] rounded-[5px] bg-[#FBF9F4] border-[2.25px] border-[#17171C] shadow-[1.5px_2px_0px_0px_#17171C] pointer-events-none flex items-center justify-center transition-transform duration-75 ${
            dragging ? 'scale-110 ring-2 ring-[#FFD426]' : ''
          }`}
          style={{ left: `${Math.min(95, Math.max(5, value * 100))}%` }}
        >
          <span className="w-[2px] h-2.5 rounded-full bg-[#17171C]/65" />
        </div>
      </div>
    </div>
  );
};
