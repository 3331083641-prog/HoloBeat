import React, { useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { holoAudio } from '../../audio/HoloAudioEngine';
import { useHoloSfx } from '../../audio/useHoloSfx';
import { SOUND_CARDS } from '../../data/soundCards';
import { useHoloStore } from '../../store/useHoloStore';
import type { PageId } from '../../types/holo';

const NAV_TABS: {
  id: PageId;
  label: string;
  zhLabel: string;
  activeBg: string;
  activeText: string;
}[] = [
  { id: 'gacha', label: '01 GACHA', zhLabel: '盲盒抽卡', activeBg: '#7C3AED', activeText: '#FFFFFF' },
  { id: 'beat', label: '02 BEAT', zhLabel: '插卡节拍', activeBg: '#FF5C2B', activeText: '#FFFFFF' },
  { id: 'pinball', label: '03 PINBALL', zhLabel: '物理弹珠', activeBg: '#00D4AA', activeText: '#1A1A1F' },
  { id: 'forge', label: '04 FORGE', zhLabel: '闪卡铸造', activeBg: '#FFD60A', activeText: '#1A1A1F' },
];

const QUICK_BPMS = [90, 110, 120, 140];

export const TopNavbar: React.FC = () => {
  const activePage = useHoloStore((s) => s.activePage);
  const setActivePage = useHoloStore((s) => s.setActivePage);
  const collectionCount = useHoloStore((s) => s.collection.length);
  const bpm = useHoloStore((s) => s.bpm);
  const setBpm = useHoloStore((s) => s.setBpm);
  const muted = useHoloStore((s) => s.muted);
  const toggleMute = useHoloStore((s) => s.toggleMute);
  const isPlaying = useHoloStore((s) => s.isPlaying);
  const setDrawerOpen = useHoloStore((s) => s.setDrawerOpen);
  const playSfx = useHoloSfx();

  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  // Live 5-bar Mint Cyan OLED equalizer synced to real Tone.js output
  useEffect(() => {
    let raf = 0;
    const heights = [0.25, 0.4, 0.55, 0.72, 0.9];
    const render = (t: number) => {
      const level = holoAudio.getMeterLevel();
      const playing = useHoloStore.getState().isPlaying;
      const isMuted = useHoloStore.getState().muted;

      barsRef.current.forEach((bar, idx) => {
        if (!bar) return;
        let h = heights[idx];
        if (isMuted) {
          h = 0.16;
        } else if (level > 0.03) {
          const jitter = Math.abs(Math.sin(t * 0.015 + idx * 1.4));
          h = Math.min(1, Math.max(0.22, level * 0.95 + jitter * 0.35));
        } else if (playing) {
          h = 0.25 + Math.abs(Math.sin(t * 0.01 + idx * 0.9)) * 0.72;
        } else {
          // Gentle idle OLED heartbeat matching mockup aesthetic
          h = heights[idx] * (0.78 + Math.sin(t * 0.003 + idx * 0.7) * 0.16);
        }
        bar.style.transform = `scaleY(${h.toFixed(2)})`;
      });
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cycleQuickBpm = () => {
    const nextIdx = (QUICK_BPMS.indexOf(bpm) + 1) % QUICK_BPMS.length;
    const nextBpm = QUICK_BPMS[nextIdx] ?? 120;
    setBpm(nextBpm);
    holoAudio.syncFromStore();
    playSfx('click', 0.7);
  };

  return (
    <header className="h-[64px] w-full bg-[#FFFDF8] border-b-[3px] border-[#1A1A1F] px-4 flex items-center justify-between gap-3 shrink-0 z-40 select-none">
      {/* Left: Tilted Mini Holographic Card Logo + HOLOBEAT */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            playSfx('tab');
            setActivePage('gacha');
          }}
          className="flex items-center gap-2.5 group cursor-pointer"
          title="回到 01 盲盒抽卡机 · 声卡造物局"
        >
          {/* Mini Tilted Iridescent Holo Card Icon */}
          <div className="relative w-7 h-9 rounded-[6px] border-[2.5px] border-[#1A1A1F] shadow-[2px_2px_0px_0px_#1A1A1F] rotate-[10deg] group-hover:rotate-[4deg] transition-transform overflow-hidden holo-shine-border flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">
              <path
                d="M12 2 L14.4 9.6 L22 12 L14.4 14.4 L12 22 L9.6 14.4 L2 12 L9.6 9.6 Z"
                fill="#FFFDF8"
                stroke="#1A1A1F"
                strokeWidth="1.4"
              />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[22px] font-black tracking-tight leading-none text-[#1A1A1F]">
              HOLOBEAT
            </span>
          </div>
        </button>

        <div className="h-7 w-[2px] bg-[#1A1A1F]/25 hidden sm:block" />
      </div>

      {/* Center: Recessed 4-Page Segmented Switcher */}
      <nav
        aria-label="主工作台切换"
        className="flex items-center gap-1.5 bg-[#EDE7D9] border-[2.5px] border-[#1A1A1F] rounded-2xl p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
      >
        {NAV_TABS.map((tab) => {
          const isActive = activePage === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                playSfx('tab');
                setActivePage(tab.id);
              }}
              title={tab.zhLabel}
              style={{
                backgroundColor: isActive ? tab.activeBg : '#FFFDF8',
                color: isActive ? tab.activeText : '#1A1A1F',
              }}
              className={`px-3.5 py-1.5 rounded-xl border-[2px] border-[#1A1A1F] text-[13px] font-black tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'shadow-[2px_2px_0px_0px_#1A1A1F] -translate-y-[0.5px]'
                  : 'hover:bg-[#F7F3E9]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Right: Collection Badge + OLED BPM/EQ Pill + Mute Button */}
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-[2px] bg-[#1A1A1F]/25 hidden sm:block" />

        {/* Collection Counter Pill */}
        <button
          onClick={() => {
            playSfx('click', 0.6);
            setDrawerOpen(true);
          }}
          title="展开全局声卡图鉴抽屉"
          className="brutal-btn h-[38px] px-3 rounded-xl bg-[#FFFDF8] flex items-center gap-1 font-mono-hw text-sm font-black text-[#1A1A1F]"
        >
          <span>{String(collectionCount).padStart(2, '0')}</span>
          <span className="text-[#5C5C6B]">/{SOUND_CARDS.length}</span>
        </button>

        {/* Dark Charcoal OLED BPM + 5 Live Mint Cyan EQ Bars */}
        <button
          onClick={cycleQuickBpm}
          title="点击快速切换全局 BPM (90 / 110 / 120 / 140)"
          className="h-[38px] px-3 rounded-xl bg-[#181820] border-[2.5px] border-[#1A1A1F] shadow-[2px_2px_0px_0px_#1A1A1F] flex items-center gap-2.5 cursor-pointer hover:brightness-110 transition-all"
        >
          <span className="font-mono-hw text-[13px] font-bold text-[#FFFDF8] tracking-wide whitespace-nowrap">
            BPM {bpm}
          </span>
          <div className="flex items-end gap-[3px] h-[18px]">
            {[0, 1, 2, 3, 4].map((idx) => (
              <span
                key={idx}
                ref={(el) => {
                  barsRef.current[idx] = el;
                }}
                style={{ transformOrigin: 'bottom center' }}
                className={`w-[5px] h-full rounded-[2px] transition-transform duration-75 ${
                  isPlaying ? 'bg-[#00D4AA] shadow-[0_0_6px_#00D4AA]' : 'bg-[#00D4AA]'
                }`}
              />
            ))}
          </div>
        </button>

        {/* Square Tactile Speaker Mute Button */}
        <button
          onClick={() => {
            toggleMute();
            holoAudio.syncFromStore();
            if (muted) playSfx('click', 0.85);
          }}
          aria-label={muted ? '取消静音' : '全局静音'}
          title={muted ? '当前已静音，点击恢复声音' : '点击一键全局静音'}
          className={`brutal-btn w-[38px] h-[38px] rounded-xl flex items-center justify-center ${
            muted ? 'bg-[#FF5C2B] text-white' : 'bg-[#FFFDF8] text-[#1A1A1F]'
          }`}
        >
          {muted ? (
            <VolumeX className="w-5 h-5" strokeWidth={2.75} />
          ) : (
            <Volume2 className="w-5 h-5" strokeWidth={2.75} />
          )}
        </button>
      </div>
    </header>
  );
};
