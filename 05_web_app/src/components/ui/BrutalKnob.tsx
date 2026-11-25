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
  color = '#FFD60A',
  size = 40,
  label,
  title,
}) => {
  const playSfx = useHoloSfx();
  const dragRef = useRef<{ startY: number; startVal: number; lastTickStep: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const angleDeg = -135 + value * 270;

  const outer = size + 12;
  const cx = outer / 2;
  const cy = outer / 2;
  const arcR = size / 2 + 3.5;
  const circumference = 2 * Math.PI * arcR;
  const arcSpan = circumference * 0.75;
  const dashOffset = arcSpan * (1 - Math.min(1, Math.max(0, value)));

  const commitValue = (nextRaw: number, tick = true) => {
    const next = Math.min(1, Math.max(0, nextRaw));
    if (tick) playSfx('knobTick', next);
    onChange(next);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.focus();
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
    commitValue(value + delta, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.01 : 0.05;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      commitValue(value + step);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      commitValue(value - step);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      commitValue(value + 0.15);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      commitValue(value - 0.15);
    } else if (e.key === 'Home') {
      e.preventDefault();
      commitValue(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      commitValue(1);
    } else if (e.key === '0' || e.key === 'Backspace') {
      e.preventDefault();
      commitValue(0.5);
    }
  };

  return (
    <div className="relative flex flex-col items-center select-none" title={title}>
      {label && (
        <span className="text-[11px] font-bold text-[#1A1A1F] mb-0.5 leading-none whitespace-nowrap">
          {label}
        </span>
      )}

      {dragging && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 px-1.5 py-0.5 rounded-md bg-[#14151B] text-[#FFD60A] border border-[#1A1A1F] font-mono-hw text-[10.5px] font-bold shadow-md pointer-events-none whitespace-nowrap">
          {Math.round(value * 100)}%
        </div>
      )}

      <div
        className="relative flex items-center justify-center"
        style={{ width: outer, height: outer }}
      >
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
            stroke="rgba(26, 26, 31, 0.16)"
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

        <div
          role="slider"
          aria-label={label ?? '旋钮控制'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value * 100)}
          aria-valuetext={`${Math.round(value * 100)}%`}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          onDoubleClick={() => {
            onChange(0.5);
            playSfx('click', 0.5);
          }}
          style={{
            width: size,
            height: size,
            backgroundColor: color,
          }}
          className={`relative rounded-full border-[2px] border-[#1A1A1F] cursor-ns-resize flex items-center justify-center transition-transform duration-100 ${
            dragging
              ? 'scale-[0.96] shadow-[1px_1px_0px_0px_#1A1A1F] brightness-105'
              : 'shadow-[2px_2px_0px_0px_#1A1A1F] hover:brightness-105'
          }`}
        >
          <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-white/40 via-transparent to-black/15 pointer-events-none" />
          <div
            className="w-full h-full flex justify-center pt-[4px] pointer-events-none"
            style={{ transform: `rotate(${angleDeg}deg)` }}
          >
            <div className="w-[3px] h-[34%] rounded-full bg-[#1A1A1F] ring-1 ring-white/55" />
          </div>
        </div>
      </div>
    </div>
  );
};
