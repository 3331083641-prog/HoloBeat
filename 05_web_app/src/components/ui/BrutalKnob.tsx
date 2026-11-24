import React, { useRef, useState } from 'react';
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
  color = '#FFD426',
  size = 42,
  label,
  title,
}) => {
  const playSfx = useHoloSfx();
  const dragRef = useRef<{ startY: number; startVal: number; lastTickStep: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const angleDeg = -135 + value * 270;

  // SVG arc geometry for 270-degree calibrated hardware scale ring
  const outer = size + 12;
  const cx = outer / 2;
  const cy = outer / 2;
  const arcR = size / 2 + 3.5;
  const circumference = 2 * Math.PI * arcR;
  const arcSpan = circumference * 0.75; // 270 deg
  const dashOffset = arcSpan * (1 - Math.min(1, Math.max(0, value)));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragRef.current = {
      startY: e.clientY,
      startVal: value,
      lastTickStep: Math.round(value * 16),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.clientY;
    const next = Math.min(1, Math.max(0, dragRef.current.startVal + dy / 115));
    const step = Math.round(next * 16);
    if (step !== dragRef.current.lastTickStep) {
      dragRef.current.lastTickStep = step;
      playSfx('knobTick', next);
    }
    onChange(next);
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const next = Math.min(1, Math.max(0, value + delta));
    playSfx('knobTick', next);
    onChange(next);
  };

  return (
    <div className="relative flex flex-col items-center select-none" title={title}>
      {label && (
        <span className="font-mono-hw text-[9.5px] font-bold tracking-[0.1em] uppercase text-[#17171C] mb-0.5 leading-none">
          {label}
        </span>
      )}

      {/* Live Numeric Tooltip while Dragging */}
      {dragging && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 px-1.5 py-0.5 rounded-md bg-[#14151B] text-[#FFD426] border border-[#17171C] font-mono-hw text-[10px] font-bold shadow-md pointer-events-none whitespace-nowrap">
          {Math.round(value * 100)}%
        </div>
      )}

      <div
        className="relative flex items-center justify-center"
        style={{ width: outer, height: outer }}
      >
        {/* Calibrated Hardware Gauge Ring */}
        <svg
          width={outer}
          height={outer}
          viewBox={`0 0 ${outer} ${outer}`}
          className="absolute inset-0 pointer-events-none"
        >
          <circle
            cx={cx}
            cy={cy}
            r={arcR}
            fill="none"
            stroke="rgba(23, 23, 28, 0.16)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray={`${arcSpan} ${circumference}`}
            transform={`rotate(135 ${cx} ${cy})`}
          />
          <circle
            cx={cx}
            cy={cy}
            r={arcR}
            fill="none"
            stroke={color}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeDasharray={`${arcSpan} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(135 ${cx} ${cy})`}
          />
        </svg>

        {/* Physical Machined Cap */}
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
          onWheel={handleWheel}
          onDoubleClick={() => {
            onChange(0.5);
            playSfx('click', 0.5);
          }}
          style={{
            width: size,
            height: size,
            backgroundColor: color,
          }}
          className={`relative rounded-full border-[2.5px] border-[#17171C] cursor-ns-resize flex items-center justify-center transition-transform duration-100 ${
            dragging
              ? 'scale-[0.96] shadow-[1px_1px_0px_0px_#17171C] brightness-105'
              : 'shadow-[2px_2.5px_0px_0px_#17171C] hover:brightness-105'
          }`}
        >
          {/* Machined Top Bevel Crescent */}
          <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-white/45 via-transparent to-black/18 pointer-events-none" />
          {/* Rotatable Indicator Notch */}
          <div
            className="w-full h-full flex justify-center pt-[4px] pointer-events-none"
            style={{ transform: `rotate(${angleDeg}deg)` }}
          >
            <div className="w-[3.5px] h-[34%] rounded-full bg-[#17171C] ring-1 ring-white/55" />
          </div>
        </div>
      </div>
    </div>
  );
};
